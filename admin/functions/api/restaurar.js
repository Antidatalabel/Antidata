import { Conflicto, guardarArchivos, leerNoticias, RUTA_NOTICIAS, textoABase64 } from '../_lib/github.js';
import { json, leerJson } from '../_lib/respuesta.js';
import { validarDatos } from '../_lib/validar.js';

// POST /api/restaurar { commit, sha } → vuelve news.json a como estaba en ese commit (como un commit nuevo)
export const onRequestPost = async ({ request, env }) => {
	const cuerpo = await leerJson(request);
	if (!cuerpo || !/^[0-9a-f]{40}$/.test(String(cuerpo.commit)) || typeof cuerpo.sha !== 'string') {
		return json({ error: 'Petición inválida' }, 400);
	}
	let anterior;
	try {
		anterior = await leerNoticias(env, cuerpo.commit);
	} catch (error) {
		return json({ error: 'No se encontró esa versión' }, 404);
	}
	const validacion = validarDatos(anterior.datos);
	if (validacion.errores.length) return json({ error: 'Esa versión no es válida', detalles: validacion.errores }, 400);
	try {
		const resultado = await guardarArchivos(env, [{
			ruta: RUTA_NOTICIAS,
			base64: textoABase64(JSON.stringify(validacion.datos, null, 2) + '\n')
		}], `Noticias: restaurar la versión ${cuerpo.commit.slice(0, 7)}`, cuerpo.sha);
		return json({ ok: true, sha: resultado.sha, datos: validacion.datos });
	} catch (error) {
		if (error instanceof Conflicto) {
			return json({ error: 'Las noticias cambiaron desde que las abriste', conflicto: true }, 409);
		}
		return json({ error: 'No se pudo guardar en GitHub' }, 502);
	}
};
