/* Validación y saneamiento en el servidor de news.json y de las imágenes subidas.
   Se descartan los campos desconocidos y se rechaza lo que no cumple el esquema.
   El sitio público, además, inserta todo como texto (nunca como HTML). */

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGEN = /^(?:img\/(?!.*\.\.)[\w\-./]+|https:\/\/[^\s"'<>]+)$/i;
const ENLACE = /^(https?:|mailto:)/i;
const RUTA_SUBIDA = /^img\/(art|flyers)\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;
const TAMANOS = [64, 400, 800, 1200, 2000];

export const MAX_NOTICIAS = 500;
export const MAX_ARCHIVOS = 8;
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;

// Texto plano: sin caracteres de control (salvo saltos de línea en el cuerpo) ni etiquetas HTML
const limpiar = (valor, maximo, multilinea) => {
	if (typeof valor !== 'string') return '';
	let texto = valor.replace(/\r\n?/g, '\n');
	texto = multilinea ? texto.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : texto.replace(/[\u0000-\u001F\u007F]/g, ' ');
	texto = texto.replace(/<[^>]*>/g, '').trim();
	return texto.length > maximo ? texto.slice(0, maximo) : texto;
};

// Cuerpo: formato acotado. Los enlaces con esquemas no permitidos quedan solo como su texto
const limpiarCuerpo = (valor) => limpiar(valor, 20000, true)
	.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (todo, textoEnlace, url) => (ENLACE.test(url) ? todo : textoEnlace));

const fechaValida = (fecha) => {
	if (!FECHA_ISO.test(fecha)) return false;
	const d = new Date(fecha + 'T00:00:00Z');
	return !isNaN(d) && d.toISOString().slice(0, 10) === fecha;
};

const validarNoticia = (n, i, errores) => {
	const donde = `noticia ${i + 1}`;
	if (!n || typeof n !== 'object') { errores.push(`${donde}: formato inválido`); return null; }
	const salida = {};
	salida.id = limpiar(n.id, 80);
	if (!ID.test(salida.id)) errores.push(`${donde}: id inválido`);
	salida.fecha = limpiar(n.fecha, 10);
	if (!fechaValida(salida.fecha)) errores.push(`${donde}: fecha inválida`);
	salida.estado = n.estado === 'publicada' ? 'publicada' : (n.estado === 'borrador' ? 'borrador' : null);
	if (!salida.estado) errores.push(`${donde}: estado inválido`);
	salida.tipo = n.tipo === 'noticia' ? 'noticia' : (n.tipo === 'lanzamiento' ? 'lanzamiento' : null);
	if (!salida.tipo) errores.push(`${donde}: tipo inválido`);
	salida.titulo = limpiar(n.titulo, 200);
	if (!salida.titulo) errores.push(`${donde}: falta el título`);

	const opcional = (campo, maximo) => { const v = limpiar(n[campo], maximo); if (v) salida[campo] = v; };
	opcional('subtitulo', 200);
	opcional('catalogo', 40);
	opcional('artista', 200);

	if (n.portada) {
		if (IMAGEN.test(n.portada)) salida.portada = n.portada; else errores.push(`${donde}: portada inválida`);
		const alt = limpiar(n.portadaAlt, 300);
		salida.portadaAlt = alt;
		if (Array.isArray(n.portadaTamanos)) {
			const tamanos = n.portadaTamanos.filter((t) => TAMANOS.indexOf(t) >= 0);
			if (tamanos.length) salida.portadaTamanos = tamanos;
		}
	}
	if (n.imagen) {
		if (IMAGEN.test(n.imagen)) salida.imagen = n.imagen; else errores.push(`${donde}: imagen inválida`);
		const alt = limpiar(n.imagenAlt, 300);
		if (alt) salida.imagenAlt = alt;
	}
	if (n.enlace) {
		const enlace = limpiar(n.enlace, 500);
		if (ENLACE.test(enlace)) salida.enlace = enlace; else errores.push(`${donde}: enlace inválido`);
	}
	if (n.bandcamp && typeof n.bandcamp === 'object') {
		const album = limpiar(String(n.bandcamp.album || ''), 20);
		if (!/^\d+$/.test(album)) {
			errores.push(`${donde}: ID de álbum de Bandcamp inválido`);
		} else {
			salida.bandcamp = { album: album };
			const url = limpiar(n.bandcamp.url, 500);
			if (url) {
				if (/^https:\/\//i.test(url)) salida.bandcamp.url = url; else errores.push(`${donde}: enlace de Bandcamp inválido`);
			}
			const texto = limpiar(n.bandcamp.texto, 200);
			if (texto) salida.bandcamp.texto = texto;
		}
	}
	salida.cuerpo = {};
	if (n.cuerpo && typeof n.cuerpo === 'object') {
		['es', 'en'].forEach((idioma) => {
			const cuerpo = limpiarCuerpo(n.cuerpo[idioma]);
			if (cuerpo) salida.cuerpo[idioma] = cuerpo;
		});
	}
	return salida;
};

export const validarDatos = (datos) => {
	const errores = [];
	if (!datos || typeof datos !== 'object' || !Array.isArray(datos.noticias)) {
		return { errores: ['El archivo de noticias no tiene el formato esperado'] };
	}
	if (datos.noticias.length > MAX_NOTICIAS) errores.push(`Máximo ${MAX_NOTICIAS} noticias`);
	const noticias = datos.noticias.slice(0, MAX_NOTICIAS).map((n, i) => validarNoticia(n, i, errores));
	const ids = {};
	noticias.forEach((n, i) => {
		if (n && ids[n.id]) errores.push(`noticia ${i + 1}: id repetido (${n.id})`);
		if (n) ids[n.id] = true;
	});
	return { errores: errores, datos: { version: 1, noticias: noticias } };
};

/* Imágenes subidas: solo JPEG, en img/art/ o img/flyers/, con un tamaño máximo, y solo
   si alguna noticia las usa */
export const validarArchivos = (archivos, datos) => {
	const errores = [];
	if (!Array.isArray(archivos)) return { errores: [], archivos: [] };
	if (archivos.length > MAX_ARCHIVOS) return { errores: [`Máximo ${MAX_ARCHIVOS} imágenes por guardado`] };
	const usadas = {};
	datos.noticias.forEach((n) => {
		if (n.portada) {
			const base = n.portada.replace(/\.jpg$/i, '');
			(n.portadaTamanos || []).forEach((t) => { usadas[`${base}-${t}.jpg`] = true; });
			usadas[n.portada] = true;
		}
		if (n.imagen) usadas[n.imagen] = true;
	});
	const validos = [];
	archivos.forEach((archivo, i) => {
		const ruta = archivo && archivo.ruta;
		if (!RUTA_SUBIDA.test(String(ruta))) { errores.push(`imagen ${i + 1}: ruta inválida`); return; }
		if (!usadas[ruta]) { errores.push(`imagen ${i + 1}: ninguna noticia la usa (${ruta})`); return; }
		let bytes;
		try { bytes = atob(String(archivo.base64 || '')); } catch (e) { errores.push(`imagen ${i + 1}: contenido inválido`); return; }
		if (bytes.length > MAX_BYTES_IMAGEN) { errores.push(`imagen ${i + 1}: supera ${MAX_BYTES_IMAGEN / 1048576} MB`); return; }
		// Firma de un JPEG: FF D8 FF
		if (bytes.charCodeAt(0) !== 0xFF || bytes.charCodeAt(1) !== 0xD8 || bytes.charCodeAt(2) !== 0xFF) {
			errores.push(`imagen ${i + 1}: no es un JPEG`); return;
		}
		validos.push({ ruta: ruta, base64: archivo.base64 });
	});
	return { errores: errores, archivos: validos };
};

export const limpiarMensaje = (mensaje) => limpiar(mensaje, 100) || 'actualizar noticias';
