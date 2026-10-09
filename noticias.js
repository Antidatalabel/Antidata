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
	// La vista previa del admin además acepta imágenes recién elegidas (blob:) que aún no se subieron
	let vistaPrevia = false;
	const imagenValida = (ruta) => IMAGEN_PERMITIDA.test(texto(ruta)) || (vistaPrevia && /^blob:/.test(texto(ruta)));

	// Negrita, cursiva y enlaces dentro de un párrafo
	const FORMATO = /\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

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
		// La portada grande de una noticia plegada no se descarga hasta desplegarla
		if (!enBarra) atributos.loading = 'lazy';
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

	// El reproductor de una noticia plegada se crea sin src (lo guarda en data-src) y se
	// carga al desplegarla: Chrome ignora loading=lazy en iframes ocultos y los cargaría todos
	const reproductor = (bandcamp, abierta) => {
		if (!bandcamp || !/^\d+$/.test(texto(bandcamp.album))) return null;
		const enlace = ENLACE_PERMITIDO.test(texto(bandcamp.url)) ? el('a', { href: bandcamp.url }, [texto(bandcamp.texto)]) : null;
		const direccion = BANDCAMP + bandcamp.album + BANDCAMP_OPCIONES;
		return el('div', { class: 'reproductor' }, [
			el('iframe', {
				class: 'iframe',
				src: abierta ? direccion : null,
				'data-src': abierta ? null : direccion,
				seamless: ''
			}, enlace ? [enlace] : [])
		]);
	};

	// Al desplegar una noticia se cargan sus reproductores pendientes
	document.addEventListener('show.bs.collapse', (evento) => {
		evento.target.querySelectorAll('iframe[data-src]').forEach((iframe) => {
			iframe.setAttribute('src', iframe.getAttribute('data-src'));
			iframe.removeAttribute('data-src');
		});
	});

	const cuerpoLanzamiento = (noticia, abierta) => [
		el('div', { class: 'col-12 col-xl-4' }, imagenValida(noticia.portada) ? [el('img', atributosPortada(noticia, 'arte-body', false))] : []),
		el('div', { class: 'col-12 col-xl-8' }, [
			reproductor(noticia.bandcamp, abierta),
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
	// opciones.abierta: desplegada al cargar (por defecto sí)
	// opciones.exclusiva: al abrirla se pliegan las demás (data-bs-parent de Bootstrap)
	const crearItem = (noticia, opciones) => {
		const abierta = !opciones || opciones.abierta !== false;
		const exclusiva = !!(opciones && opciones.exclusiva);
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
			'data-bs-parent': exclusiva ? '#accordion' : null,
			'data-bs-parent-off': exclusiva ? null : '#accordion'
		}, [el('div', { class: 'accordion-body' }, [
			el('div', { class: esLanzamiento ? 'container' : 'container mt-3' }, [
				el('div', { class: 'row' }, esLanzamiento ? cuerpoLanzamiento(noticia, abierta) : cuerpoNoticia(noticia))
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

	// Cuántas noticias empiezan desplegadas según el total publicado (solo en la
	// primera página, las más recientes). Desde LIMITE_EXCLUSIVA noticias, abrir una
	// pliega las demás. Valores medidos: en móvil caben 6 plegadas por pantalla y en
	// escritorio caben 1 o 2 desplegadas.
	const abiertasIniciales = (total) => (total <= 3 ? total : (total <= 5 ? 2 : 1));
	const LIMITE_EXCLUSIVA = 6;

	// Opciones por defecto para un conjunto de noticias ya ordenadas
	const opcionesPara = (indice, total) => ({
		abierta: indice < abiertasIniciales(total),
		exclusiva: total >= LIMITE_EXCLUSIVA
	});

	const crearItems = (noticias) => {
		const publicadas = ordenar(noticias);
		return publicadas.map((noticia, i) => crearItem(noticia, opcionesPara(i, publicadas.length)));
	};

	// Dibuja todas las noticias publicadas (sin paginar); lo usa la vista previa del admin
	const renderizar = (contenedor, noticias) => {
		contenedor.querySelectorAll('.accordion-item, .noticias-error').forEach((n) => n.parentNode.removeChild(n));
		const fragmento = document.createDocumentFragment();
		crearItems(noticias).forEach((item) => fragmento.appendChild(item));
		contenedor.appendChild(fragmento);
	};

	const mostrarError = (contenedor) => {
		contenedor.appendChild(el('div', { class: 'noticias-error' }, [
			el('div', { class: 'noticia-texto', lang: 'es' }, [el('p', { class: 'centrado' }, ['No se pudieron cargar las noticias.'])]),
			el('div', { class: 'noticia-texto', lang: 'en' }, [el('p', { class: 'centrado' }, ['News could not be loaded.'])])
		]));
	};

	window.AntidataNoticias = {
		crearItem: crearItem,
		renderizar: renderizar,
		ordenar: ordenar,
		activarVistaPrevia: () => { vistaPrevia = true; }
	};

	/* PAGINACIÓN MEDIDA
	   Cada página lleva tantas noticias como caben plegadas en el alto de la pantalla
	   (menos los controles), midiendo el alto real de cada barra plegada. Si una
	   noticia desplegada no cabe, el contenedor crece. Se recalcula con
	   ResizeObserver (ancho) y con resize (alto, ignorando la barra de direcciones
	   del móvil), con debounce. */

	const ALTO_CONTROLES = 60;
	const CAMBIO_ALTO_MINIMO = 120;
	const ESPERA_RECALCULO = 200;

	const TEXTOS = {
		es: { nav: 'Páginas de noticias', anterior: 'Página anterior', siguiente: 'Página siguiente', pagina: 'Página', de: 'de' },
		en: { nav: 'News pages', anterior: 'Previous page', siguiente: 'Next page', pagina: 'Page', de: 'of' }
	};
	const textos = () => (document.documentElement.getAttribute('lang') === 'en' ? TEXTOS.en : TEXTOS.es);

	const paginar = (contenedor, noticias) => {
		const items = crearItems(noticias);
		let paginas = [];
		let actual = 0;

		items.forEach((item) => contenedor.appendChild(item));

		const anterior = el('button', { type: 'button', class: 'paginacion-flecha' }, ['‹']);
		const siguiente = el('button', { type: 'button', class: 'paginacion-flecha' }, ['›']);
		const numeros = el('span', { class: 'paginacion-numeros' });
		const aviso = el('p', { class: 'visually-hidden', 'aria-live': 'polite' });
		const nav = el('nav', { class: 'paginacion' }, [anterior, numeros, siguiente, aviso]);
		nav.hidden = true;
		contenedor.parentNode.insertBefore(nav, contenedor.nextSibling);

		// Alto de cada noticia plegada. Se pliegan y muestran por un instante dentro
		// de la misma tarea, así que el navegador nunca llega a pintarlo.
		const medirPlegadas = () => {
			const estados = items.map((item) => {
				const panel = item.querySelector('.accordion-collapse');
				const visible = panel.classList.contains('show');
				const oculto = item.hidden;
				item.hidden = false;
				panel.classList.remove('show');
				return { panel: panel, visible: visible, oculto: oculto };
			});
			const altos = items.map((item) => item.offsetHeight);
			items.forEach((item, i) => {
				if (estados[i].visible) estados[i].panel.classList.add('show');
				item.hidden = estados[i].oculto;
			});
			return altos;
		};

		// Reparte las noticias en páginas: cada una suma alturas plegadas hasta llenar
		// el alto disponible (al menos una noticia por página)
		const calcularPaginas = (altos, disponible) => {
			const resultado = [];
			let pagina = [];
			let suma = 0;
			altos.forEach((alto, i) => {
				if (pagina.length && suma + alto > disponible) {
					resultado.push(pagina);
					pagina = [];
					suma = 0;
				}
				pagina.push(i);
				suma += alto;
			});
			if (pagina.length) resultado.push(pagina);
			return resultado;
		};

		let irA;

		const dibujarControles = () => {
			const t = textos();
			nav.hidden = paginas.length < 2;
			nav.setAttribute('aria-label', t.nav);
			anterior.setAttribute('aria-label', t.anterior);
			siguiente.setAttribute('aria-label', t.siguiente);
			anterior.disabled = actual === 0;
			siguiente.disabled = actual >= paginas.length - 1;
			while (numeros.firstChild) numeros.removeChild(numeros.firstChild);
			paginas.forEach((_, i) => {
				const boton = el('button', {
					type: 'button',
					'aria-label': t.pagina + ' ' + (i + 1),
					'aria-current': i === actual ? 'page' : null
				}, [String(i + 1)]);
				boton.addEventListener('click', () => irA(i, true));
				numeros.appendChild(boton);
			});
		};

		const mostrar = () => {
			items.forEach((item, i) => { item.hidden = paginas[actual].indexOf(i) < 0; });
			dibujarControles();
		};

		irA = (pagina, porUsuario) => {
			const conFoco = nav.contains(document.activeElement);
			actual = Math.max(0, Math.min(pagina, paginas.length - 1));
			mostrar();
			if (porUsuario) {
				const t = textos();
				aviso.textContent = t.pagina + ' ' + (actual + 1) + ' ' + t.de + ' ' + paginas.length;
				// Si el inicio de las noticias quedó arriba de la pantalla, se vuelve a él
				if (contenedor.getBoundingClientRect().top < 0) contenedor.scrollIntoView({ block: 'start' });
				// Los números se vuelven a dibujar: el foco pasa al de la página elegida
				const elegido = numeros.querySelector('[aria-current="page"]');
				if (conFoco && elegido) elegido.focus();
			}
		};

		// Recalcula las páginas manteniendo visible la primera noticia de la página actual
		const recalcular = () => {
			if (contenedor.querySelector('.collapsing')) {
				// Hay una animación del acordeón en curso: se mide cuando termine
				setTimeout(recalcular, ESPERA_RECALCULO);
				return;
			}
			const primera = paginas.length ? paginas[actual][0] : 0;
			paginas = calcularPaginas(medirPlegadas(), window.innerHeight - ALTO_CONTROLES);
			let nueva = 0;
			paginas.forEach((pagina, i) => { if (pagina.indexOf(primera) >= 0) nueva = i; });
			irA(nueva, false);
		};

		let temporizador = null;
		const programar = () => {
			clearTimeout(temporizador);
			temporizador = setTimeout(recalcular, ESPERA_RECALCULO);
		};

		anterior.addEventListener('click', () => irA(actual - 1, true));
		siguiente.addEventListener('click', () => irA(actual + 1, true));

		// Ancho: ResizeObserver sobre el contenedor (o resize en navegadores sin él)
		let ultimoAncho = contenedor.clientWidth;
		let ultimoAlto = window.innerHeight;
		if (window.ResizeObserver) {
			new ResizeObserver(() => {
				if (Math.abs(contenedor.clientWidth - ultimoAncho) > 1) {
					ultimoAncho = contenedor.clientWidth;
					programar();
				}
			}).observe(contenedor);
		}
		// Alto: solo cambios grandes (no la barra de direcciones que aparece y desaparece en el móvil)
		window.addEventListener('resize', () => {
			const cambioAncho = !window.ResizeObserver && Math.abs(contenedor.clientWidth - ultimoAncho) > 1;
			if (cambioAncho || Math.abs(window.innerHeight - ultimoAlto) > CAMBIO_ALTO_MINIMO) {
				ultimoAncho = contenedor.clientWidth;
				ultimoAlto = window.innerHeight;
				programar();
			}
		});

		// Al desplegar una noticia, si su encabezado quedó arriba de la pantalla
		// (p. ej. porque se plegaron las de arriba), se lleva a la vista
		contenedor.addEventListener('shown.bs.collapse', (evento) => {
			const item = evento.target.closest('.accordion-item');
			if (item && item.getBoundingClientRect().top < 0) item.scrollIntoView({ block: 'start' });
		});

		// Los textos de los controles siguen al selector de idioma
		document.addEventListener('antidata:idioma', dibujarControles);

		recalcular();
		// Las fuentes cambian el alto de las barras: se vuelve a medir cuando terminan de cargar
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalcular);
	};

	// Sitio público: carga el JSON indicado en data-noticias
	const contenedor = document.querySelector('[data-noticias]');
	if (contenedor && window.fetch) {
		fetch(contenedor.getAttribute('data-noticias'))
			.then((respuesta) => {
				if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
				return respuesta.json();
			})
			.then((datos) => paginar(contenedor, datos && datos.noticias))
			.catch(() => mostrarError(contenedor))
			.then(() => contenedor.classList.remove('noticias-cargando'));
	}

})();
