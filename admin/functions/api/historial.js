import { historial } from '../_lib/github.js';
import { json } from '../_lib/respuesta.js';

// GET /api/historial → últimos cambios de news.json
export const onRequestGet = async ({ env }) => {
	try {
		return json({ cambios: await historial(env) });
	} catch (error) {
		return json({ error: 'No se pudo leer el historial desde GitHub' }, 502);
	}
};
