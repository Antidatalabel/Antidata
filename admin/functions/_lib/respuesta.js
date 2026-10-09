// Respuestas JSON de la API: nunca se guardan en caché ni se indexan
export const json = (datos, estado = 200, cabeceras = {}) => new Response(JSON.stringify(datos), {
	status: estado,
	headers: {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store',
		'X-Robots-Tag': 'noindex, nofollow',
		...cabeceras
	}
});

export const leerJson = async (request) => {
	try {
		return await request.json();
	} catch (e) {
		return null;
	}
};
