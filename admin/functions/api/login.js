import { bloqueoRestante, cookieSesion, crearToken, limpiarFallos, registrarFallo, verificarClave } from '../_lib/auth.js';
import { json, leerJson } from '../_lib/respuesta.js';

// POST /api/login { clave } → cookie de sesión
export const onRequestPost = async ({ request, env }) => {
	const restante = await bloqueoRestante(request, env);
	if (restante > 0) {
		return json({ error: 'Demasiados intentos', espera: restante }, 429, { 'Retry-After': String(restante) });
	}
	const cuerpo = await leerJson(request);
	const clave = cuerpo && typeof cuerpo.clave === 'string' ? cuerpo.clave : '';
	if (!clave || !(await verificarClave(clave, env.ADMIN_PASSWORD_HASH))) {
		await registrarFallo(request, env);
		return json({ error: 'Contraseña incorrecta' }, 401);
	}
	await limpiarFallos(request, env);
	return json({ ok: true }, 200, { 'Set-Cookie': cookieSesion(await crearToken(env.SESSION_SECRET)) });
};
