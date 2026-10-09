/* Autenticación del admin.
   - Contraseña: hash PBKDF2-SHA256 guardado como secreto ADMIN_PASSWORD_HASH con el
     formato pbkdf2$<iteraciones>$<sal base64>$<hash base64> (ver herramientas/generar-hash.ps1).
   - Sesión: cookie firmada con HMAC-SHA256 (secreto SESSION_SECRET) que contiene solo la
     fecha de expiración. No se guarda nada en el servidor.
   - Intentos de login: contador por IP en Workers KV (binding INTENTOS). */

const enc = new TextEncoder();

export const NOMBRE_COOKIE = '__Host-atd_sesion';
export const DURACION_SESION = 8 * 60 * 60; // segundos
export const MAX_FALLOS = 5;
export const BLOQUEO = 15 * 60; // segundos

const aBase64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
	.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const deBase64 = (texto) => {
	const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(normal + '='.repeat((4 - normal.length % 4) % 4)), (c) => c.charCodeAt(0));
};

// Comparación en tiempo constante
export const iguales = (a, b) => {
	if (a.length !== b.length) return false;
	let diferencia = 0;
	for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
	return diferencia === 0;
};

export const verificarClave = async (clave, hashGuardado) => {
	const partes = String(hashGuardado || '').split('$');
	if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false;
	const iteraciones = parseInt(partes[1], 10);
	if (!(iteraciones > 0 && iteraciones <= 100000)) return false; // límite de Workers
	const sal = deBase64(partes[2]);
	const esperado = deBase64(partes[3]);
	const llave = await crypto.subtle.importKey('raw', enc.encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
		llave, esperado.length * 8);
	return iguales(new Uint8Array(bits), esperado);
};

const llaveHmac = (secreto) => crypto.subtle.importKey(
	'raw', enc.encode(String(secreto)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

export const crearToken = async (secreto, ahora = Date.now()) => {
	const carga = aBase64Url(enc.encode(JSON.stringify({ exp: Math.floor(ahora / 1000) + DURACION_SESION })));
	const firma = await crypto.subtle.sign('HMAC', await llaveHmac(secreto), enc.encode(carga));
	return carga + '.' + aBase64Url(firma);
};

export const tokenValido = async (token, secreto, ahora = Date.now()) => {
	if (!secreto || typeof token !== 'string' || token.indexOf('.') < 0) return false;
	const [carga, firma] = token.split('.');
	const esperada = new Uint8Array(await crypto.subtle.sign('HMAC', await llaveHmac(secreto), enc.encode(carga)));
	let recibida;
	try { recibida = deBase64(firma); } catch (e) { return false; }
	if (!iguales(recibida, esperada)) return false;
	try {
		const datos = JSON.parse(new TextDecoder().decode(deBase64(carga)));
		return typeof datos.exp === 'number' && datos.exp * 1000 > ahora;
	} catch (e) {
		return false;
	}
};

export const leerCookie = (request, nombre) => {
	const cabecera = request.headers.get('Cookie') || '';
	const par = cabecera.split(/;\s*/).find((c) => c.indexOf(nombre + '=') === 0);
	return par ? par.slice(nombre.length + 1) : null;
};

export const cookieSesion = (token) =>
	`${NOMBRE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_SESION}`;

export const cookieCerrada = () =>
	`${NOMBRE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const sesionValida = (request, env) => tokenValido(leerCookie(request, NOMBRE_COOKIE), env.SESSION_SECRET);

// Las peticiones que modifican algo deben venir del propio admin
export const origenValido = (request) => {
	const origen = request.headers.get('Origin');
	return !!origen && origen === new URL(request.url).origin;
};

/* Límite de intentos: hasta MAX_FALLOS fallos por IP; luego BLOQUEO segundos sin poder
   intentar. Devuelve los segundos restantes de bloqueo (0 si puede intentar). */
const claveIntentos = (request) => 'login:' + (request.headers.get('CF-Connecting-IP') || 'desconocida');

export const bloqueoRestante = async (request, env, ahora = Date.now()) => {
	const registro = await env.INTENTOS.get(claveIntentos(request), 'json');
	return registro && registro.hasta > ahora ? Math.ceil((registro.hasta - ahora) / 1000) : 0;
};

export const registrarFallo = async (request, env, ahora = Date.now()) => {
	const clave = claveIntentos(request);
	const registro = (await env.INTENTOS.get(clave, 'json')) || { fallos: 0, hasta: 0 };
	registro.fallos += 1;
	if (registro.fallos >= MAX_FALLOS) {
		registro.fallos = 0;
		registro.hasta = ahora + BLOQUEO * 1000;
	}
	await env.INTENTOS.put(clave, JSON.stringify(registro), { expirationTtl: 3600 });
};

export const limpiarFallos = (request, env) => env.INTENTOS.delete(claveIntentos(request));
