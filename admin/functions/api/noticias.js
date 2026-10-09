import { Conflicto, guardarArchivos, leerNoticias, RUTA_NOTICIAS, textoABase64 } from '../_lib/github.js';
import { json, leerJson } from '../_lib/respuesta.js';
import { limpiarMensaje, validarArchivos, validarDatos } from '../_lib/validar.js';

// GET /api/noticias → { sha, datos }
export const onRequestGet = async ({ env }) => {
	try {
		return json(await leerNoticias(env));
	} catch (error) {
		return json({ error: 'No se pudo leer news.json desde GitHub' }, 502);
	}
};

// PUT /api/noticias { sha, mensaje, datos, archivos } → un commit con news.json y las imágenes
export const onRequestPut = async ({ request, env }) => {
	const cuerpo = await leerJson(request);
	if (!cuerpo || typeof cuerpo.sha !== 'string') return json({ error: 'Petición inválida' }, 400);

	const validacion = validarDatos(cuerpo.datos);
	if (validacion.errores.length) return json({ error: 'Datos inválidos', detalles: validacion.errores }, 400);
	const imagenes = validarArchivos(cuerpo.archivos, validacion.datos);
	if (imagenes.errores.length) return json({ error: 'Imágenes inválidas', detalles: imagenes.errores }, 400);

	const archivos = imagenes.archivos.concat([{
		ruta: RUTA_NOTICIAS,
		base64: textoABase64(JSON.stringify(validacion.datos, null, 2) + '\n')
	}]);
	try {
		const resultado = await guardarArchivos(env, archivos, 'Noticias: ' + limpiarMensaje(cuerpo.mensaje), cuerpo.sha);
		return json({ ok: true, sha: resultado.sha, commit: resultado.commit, datos: validacion.datos });
	} catch (error) {
		if (error instanceof Conflicto) {
			return json({ error: 'Las noticias cambiaron desde que las abriste', conflicto: true }, 409);
		}
		return json({ error: 'No se pudo guardar en GitHub' }, 502);
	}
};
