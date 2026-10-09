/* NOTICIAS: se cargan desde data/news.json y se dibujan con el mismo marcado y las
   mismas clases que antes estaban escritas a mano en index.html (acordeón de
   Bootstrap, estilos y selector de idioma siguen funcionando igual).

   Todo el texto se inserta con textContent: nunca se interpreta HTML del JSON.
   El cuerpo admite un formato acotado:
     - párrafos separados por una línea en blanco (un salto simple es un espacio)
     - **negrita**, *cursiva* y [texto](https://enlace)
   Lo usa también el admin para la vista previa (window.AntidataNoticias). */

(function () {

	const BANDCAMP = 'https://bandcamp.com/EmbeddedPlayer/album=';
	const BANDCAMP_OPCIONES = '/size=small/bgcol=transparent/linkcol=0687f5/transparent=true/';
	const ENLACE_PERMITIDO = /^(https?:|mailto:)/i;
	const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
	const IDIOMAS = ['es', 'en'];
	// Imágenes: solo rutas dentro de img/ (sin "..") o enlaces https
	const IMAGEN_PERMITIDA = /^(?:img\/(?!.*\.\.)[\w\-./]+|https:\/\/[^\s"'<>]+)$/i;

	// Crea un elemento con clases y atributos; los hijos pueden ser nodos o texto
	const el = (etiqueta, atributos, hijos) => {
		const nodo = document.createElement(etiqueta);
		if (atributos) {
			Object.keys(atributos).forEach((nombre) => {
				if (atributos[nombre] !== null && atributos[nombre] !== undefined) {
					nodo.setAttribute(nombre, atributos[nombre]);
				}
			});
		}
		(hijos || []).forEach((hijo) => {
			nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
		});
		return nodo;
	};

	const texto = (valor) => (typeof valor === 'string' ? valor : '');
	const imagenValida = (ruta) => IMAGEN_PERMITIDA.test(texto(ruta));

	// Negrita, cursiva y enlaces dentro de un párrafo
	const FORMATO = /\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

	const agregarEnLinea = (padre, contenido) => {
		let ultimo = 0;
		let m;
		FORMATO.lastIndex = 0;
		while ((m = FORMATO.exec(contenido)) !== null) {
			if (m.index > ultimo) {
				padre.appendChild(document.createTextNode(contenido.slice(ultimo, m.index)));
			}
			const reanudar = FORMATO.lastIndex;
			if (m[1] !== undefined) {
				// Misma apariencia que el texto destacado que se usaba a mano
				const negrita = el('strong', { class: 'destacado' });
				agregarEnLinea(negrita, m[1]);
				padre.appendChild(negrita);
			} else if (m[2] !== undefined) {
				const cursiva = el('em');
				agregarEnLinea(cursiva, m[2]);
				padre.appendChild(cursiva);
			} else if (ENLACE_PERMITIDO.test(m[4])) {
				const externo = !/^mailto:/i.test(m[4]);
				const enlace = el('a', {
					href: m[4],
					target: externo ? '_blank' : null,
					rel: externo ? 'noopener noreferrer' : null
				});
				agregarEnLinea(enlace, m[3]);
				padre.appendChild(enlace);
			} else {
				// Enlace con un esquema no permitido (p. ej. javascript:): solo su texto
				padre.appendChild(document.createTextNode(m[3]));
			}
			FORMATO.lastIndex = reanudar;
			ultimo = reanudar;
		}
		if (ultimo < contenido.length) {
			padre.appendChild(document.createTextNode(contenido.slice(ultimo)));
		}
	};

	const parrafos = (cuerpo) => texto(cuerpo)
		.replace(/\r\n?/g, '\n')
		.split(/\n[ \t]*\n+/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	// Un bloque por idioma; el CSS muestra solo el idioma activo
	const bloquesIdioma = (cuerpo, claseParrafo) => IDIOMAS
		.filter((idioma) => cuerpo && texto(cuerpo[idioma]).trim())
		.map((idioma) => el('div', { class: 'noticia-texto', lang: idioma },
			parrafos(cuerpo[idioma]).map((p) => {
				const parrafo = el('p', { class: claseParrafo });
				agregarEnLinea(parrafo, p);
				return parrafo;
			})));

	// Portada: si hay versiones reducidas (img/art/x-400.jpg, ...), el navegador
	// elige la que necesita; si no, se usa el archivo original
	const atributosPortada = (noticia, clase, enBarra) => {
		const ruta = texto(noticia.portada);
		const tamanos = Array.isArray(noticia.portadaTamanos) ? noticia.portadaTamanos.slice().sort((a, b) => a - b) : [];
		const base = ruta.replace(/\.[a-z0-9]+$/i, '');
		const extension = (ruta.match(/\.[a-z0-9]+$/i) || [''])[0];
		const atributos = { class: clase, alt: texto(noticia.portadaAlt), src: ruta };
		if (tamanos.length) {
			const version = (ancho) => base + '-' + ancho + extension;
			if (enBarra) {
				atributos.src = version(tamanos[0]);
			} else {
				atributos.src = version(tamanos[tamanos.length - 1]);
				atributos.srcset = tamanos.map((ancho) => version(ancho) + ' ' + ancho + 'w').join(', ');
				atributos.sizes = '(min-width: 1200px) 350px, 100vw';
			}
		}
		return atributos;
	};

	const anio = (noticia) => (FECHA_ISO.test(texto(noticia.fecha)) ? noticia.fecha.slice(0, 4) : '');

	const fechaCorta = (noticia) => {
		if (!FECHA_ISO.test(texto(noticia.fecha))) return '';
		const partes = noticia.fecha.split('-');
		return partes[2] + '.' + partes[1] + '.' + partes[0];
	};

	// Encabezado del lanzamiento: catálogo / título, artista, año y miniatura
	const columnasLanzamiento = (noticia) => [
		el('div', { class: 'col-3' }, [(noticia.catalogo ? noticia.catalogo + ' / ' : '') + texto(noticia.titulo)]),
		el('div', { class: 'col-3' }, noticia.artista ? ['by ', el('span', { class: 'destacado' }, [noticia.artista])] : []),
		el('div', { class: 'col-3' }, [anio(noticia)]),
		el('div', { class: 'col-3' }, imagenValida(noticia.portada) ? [el('img', atributosPortada(noticia, 'arte-header', true))] : [])
	];

	// Encabezado de una noticia general: título y fecha
	const columnasNoticia = (noticia) => [
		el('div', { class: 'col-9' }, [el('span', { class: 'destacado' }, [texto(noticia.titulo)])]),
		el('div', { class: 'col' }, [fechaCorta(noticia)])
	];

	const reproductor = (bandcamp) => {
		if (!bandcamp || !/^\d+$/.test(texto(bandcamp.album))) return null;
		const enlace = ENLACE_PERMITIDO.test(texto(bandcamp.url)) ? el('a', { href: bandcamp.url }, [texto(bandcamp.texto)]) : null;
		return el('div', { class: 'reproductor' }, [
			el('iframe', { class: 'iframe', src: BANDCAMP + bandcamp.album + BANDCAMP_OPCIONES, seamless: '' }, enlace ? [enlace] : [])
		]);
	};

	const cuerpoLanzamiento = (noticia) => [
		el('div', { class: 'col-12 col-xl-4' }, imagenValida(noticia.portada) ? [el('img', atributosPortada(noticia, 'arte-body', false))] : []),
		el('div', { class: 'col-12 col-xl-8' }, [
			reproductor(noticia.bandcamp),
			el('p', { class: 'mt-3 pe-xl-5' }),
			noticia.subtitulo ? el('p', { class: 'pe-xl-5' }, [el('span', { class: 'destacado' }, [noticia.subtitulo])]) : null
		].filter(Boolean).concat(bloquesIdioma(noticia.cuerpo, 'pe-xl-5')))
	];

	const cuerpoNoticia = (noticia) => {
		const imagen = imagenValida(noticia.imagen) ? el('img', { class: 'flyer', alt: texto(noticia.imagenAlt), src: noticia.imagen }) : null;
		const conEnlace = imagen && ENLACE_PERMITIDO.test(texto(noticia.enlace))
			? el('a', { href: noticia.enlace, target: '_blank', rel: 'noopener noreferrer' }, [imagen])
			: imagen;
		return [
			el('div', { class: imagen ? 'col-xl-6' : 'col' }, bloquesIdioma(noticia.cuerpo, null)),
			conEnlace ? el('div', { class: 'col-xl-6' }, [conEnlace]) : null
		].filter(Boolean);
	};

	// Un elemento del acordeón con el mismo marcado que se escribía a mano
	const crearItem = (noticia, opciones) => {
		const abierta = !opciones || opciones.abierta !== false;
		const id = texto(noticia.id).replace(/[^a-z0-9-]/gi, '') || 'noticia';
		const esLanzamiento = noticia.tipo !== 'noticia';
		const header = 'header-' + id;
		const body = 'body-' + id;

		const boton = el('button', {
			class: 'accordion-button' + (abierta ? '' : ' collapsed'),
			type: 'button',
			'data-bs-toggle': 'collapse',
			'data-bs-target': '#' + body,
			'aria-expanded': abierta ? 'true' : 'false',
			'aria-controls': body
		}, [el('div', { class: 'container' }, [
			el('div', { class: 'row' }, esLanzamiento ? columnasLanzamiento(noticia) : columnasNoticia(noticia))
		])]);

		const panel = el('div', {
			id: body,
			class: 'accordion-collapse collapse' + (abierta ? ' show' : ''),
			'aria-labelledby': header,
			'data-bs-parent-off': '#accordion'
		}, [el('div', { class: 'accordion-body' }, [
			el('div', { class: esLanzamiento ? 'container' : 'container mt-3' }, [
				el('div', { class: 'row' }, esLanzamiento ? cuerpoLanzamiento(noticia) : cuerpoNoticia(noticia))
			])
		])]);

		return el('div', { class: 'accordion-item' }, [
			el('h2', { class: 'accordion-header', id: header }, [boton]),
			panel
		]);
	};

	// Solo publicadas, de la más nueva a la más antigua; a igual fecha, el orden del archivo
	const ordenar = (noticias) => (Array.isArray(noticias) ? noticias : [])
		.map((noticia, indice) => ({ noticia: noticia, indice: indice }))
		.filter((x) => x.noticia && x.noticia.estado === 'publicada' && FECHA_ISO.test(texto(x.noticia.fecha)))
		.sort((a, b) => (a.noticia.fecha === b.noticia.fecha ? a.indice - b.indice : (a.noticia.fecha < b.noticia.fecha ? 1 : -1)))
		.map((x) => x.noticia);

	const renderizar = (contenedor, noticias, opciones) => {
		const fragmento = document.createDocumentFragment();
		ordenar(noticias).forEach((noticia) => fragmento.appendChild(crearItem(noticia, opciones)));
		contenedor.querySelectorAll('.accordion-item, .noticias-error').forEach((n) => n.parentNode.removeChild(n));
		contenedor.appendChild(fragmento);
	};

	const mostrarError = (contenedor) => {
		contenedor.appendChild(el('div', { class: 'noticias-error' }, [
			el('div', { class: 'noticia-texto', lang: 'es' }, [el('p', { class: 'centrado' }, ['No se pudieron cargar las noticias.'])]),
			el('div', { class: 'noticia-texto', lang: 'en' }, [el('p', { class: 'centrado' }, ['News could not be loaded.'])])
		]));
	};

	window.AntidataNoticias = { crearItem: crearItem, renderizar: renderizar, ordenar: ordenar };

	// Sitio público: carga el JSON indicado en data-noticias
	const contenedor = document.querySelector('[data-noticias]');
	if (contenedor && window.fetch) {
		fetch(contenedor.getAttribute('data-noticias'))
			.then((respuesta) => {
				if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
				return respuesta.json();
			})
			.then((datos) => renderizar(contenedor, datos && datos.noticias))
			.catch(() => mostrarError(contenedor))
			.then(() => contenedor.classList.remove('noticias-cargando'));
	}

})();
