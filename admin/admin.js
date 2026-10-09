/* Admin de noticias: listar, crear, editar, borrar, borrador/publicada, vista previa
   e historial. Habla solo con /api/* (Cloudflare Pages Functions); el token de GitHub
   nunca llega al navegador. */

(function () {

	// Las imágenes ya publicadas se ven en la vista previa desde el sitio
	const SITIO = 'https://antidata.id/';
	// Anchos de portada generados al subir (la barra usa 64; el resto, según la pantalla)
	const TAMANOS_PORTADA = [64, 400, 800, 1200, 2000];
	const ANCHO_FLYER = 1200;
	const CALIDAD_JPEG = 0.82;

	const $ = (selector) => document.querySelector(selector);
	const form = $('#form-noticia');
	const campo = (nombre) => form.elements[nombre];

	const estado = {
		sha: null,
		datos: null,
		editando: null,      // id de la noticia abierta (null si es nueva)
		idNuevo: null,       // id asignado a una noticia nueva
		imagen: null,        // imagen elegida y aún no guardada
		original: '',        // para avisar de cambios sin guardar
		vistaAbierta: true,
		idiomaVista: 'es'
	};

	/* ---------- utilidades ---------- */

	const hoy = () => {
		const d = new Date();
		return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
	};

	const slug = (texto) => String(texto || '').toLowerCase()
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

	const idUnico = (base) => {
		const ids = estado.datos.noticias.map((n) => n.id);
		let id = base || 'noticia';
		let i = 2;
		while (ids.indexOf(id) >= 0) id = base + '-' + (i++);
		return id;
	};

	const fechaLegible = (iso) => {
		const d = new Date(iso);
		return isNaN(d) ? '' : d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
	};

	const MENSAJE_DEMO = 'Modo de prueba local: aquí no hay servidor (el admin real funciona en admin.antidata.id). Puedes mirar y probar el formulario y la vista previa, pero no se guarda nada.';

	const avisar = (texto, error) => {
		const aviso = $('#aviso');
		// En el modo de prueba local el aviso nunca queda vacío
		if (!texto && estado.demo) texto = MENSAJE_DEMO;
		aviso.textContent = texto;
		aviso.classList.toggle('error', !!error);
		aviso.hidden = !texto;
	};

	const mostrar = (vista) => {
		['login', 'lista', 'historial', 'form'].forEach((v) => { $('#vista-' + v).hidden = v !== vista; });
		$('#acciones').hidden = vista === 'login';
		window.scrollTo(0, 0);
	};

	// Botón que pide una segunda pulsación para confirmar (sin diálogos del navegador)
	const confirmarCon = (boton, texto, accion) => {
		if (boton.dataset.confirmando) {
			delete boton.dataset.confirmando;
			boton.textContent = boton.dataset.textoOriginal;
			accion();
			return;
		}
		boton.dataset.textoOriginal = boton.textContent;
		boton.dataset.confirmando = '1';
		boton.textContent = texto;
		setTimeout(() => {
			if (boton.dataset.confirmando) {
				delete boton.dataset.confirmando;
				boton.textContent = boton.dataset.textoOriginal;
			}
		}, 5000);
	};

	/* ---------- API ---------- */

	const api = async (metodo, ruta, cuerpo) => {
		const respuesta = await fetch('/api/' + ruta, {
			method: metodo,
			credentials: 'same-origin',
			headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
			body: cuerpo ? JSON.stringify(cuerpo) : undefined
		});
		let datos = {};
		try { datos = await respuesta.json(); } catch (e) {}
		if (respuesta.status === 401 && ruta !== 'login') {
			mostrar('login');
			// Solo si ya se estaba usando (no al abrir el admin por primera vez)
			if (estado.datos) avisar('La sesión terminó. Vuelve a entrar.', true);
		}
		return { status: respuesta.status, ok: respuesta.ok, datos: datos };
	};

	const errorDe = (r) => r.datos.error + (r.datos.detalles ? ': ' + r.datos.detalles.join('; ') : '');

	// Sin servidor (p. ej. abriendo admin/ con Live Server): modo de prueba local que lee
	// ../data/news.json y no guarda nada
	const cargarDemo = async () => {
		try {
			const r = await fetch('../data/news.json', { cache: 'no-store' });
			if (!r.ok) throw new Error();
			estado.datos = await r.json();
			estado.sha = 'demo';
			avisar('');
			return true;
		} catch (e) {
			avisar('Modo de prueba local: no se encontró ../data/news.json.', true);
			return false;
		}
	};

	const cargar = async () => {
		if (estado.demo) return cargarDemo();
		const r = await api('GET', 'noticias');
		if (r.status === 404 && !estado.datos) {
			estado.demo = true;
			return cargarDemo();
		}
		if (r.status === 401) return false;
		if (!r.ok) { avisar(errorDe(r), true); return false; }
		estado.sha = r.datos.sha;
		estado.datos = r.datos.datos;
		return true;
	};

	/* ---------- lista ---------- */

	const mostrarLista = () => {
		const lista = $('#lista');
		while (lista.firstChild) lista.removeChild(lista.firstChild);
		const noticias = estado.datos.noticias.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0)));
		noticias.forEach((n) => {
			const li = document.createElement('li');
			const boton = document.createElement('button');
			boton.type = 'button';
			const titulo = document.createElement('span');
			titulo.className = 'titulo';
			titulo.textContent = (n.catalogo ? n.catalogo + ' / ' : '') + n.titulo;
			const fecha = document.createElement('span');
			fecha.className = 'fecha suave';
			fecha.textContent = n.fecha;
			const etiqueta = document.createElement('span');
			etiqueta.className = 'etiqueta ' + n.estado;
			etiqueta.textContent = n.estado === 'publicada' ? 'publicada' : 'borrador';
			boton.append(titulo, fecha, etiqueta);
			boton.addEventListener('click', () => editar(n.id));
			li.appendChild(boton);
			lista.appendChild(li);
		});
		$('#lista-vacia').hidden = noticias.length > 0;
		mostrar('lista');
	};

	/* ---------- formulario ---------- */

	const noticiaActual = () => estado.datos.noticias.find((n) => n.id === estado.editando) || null;

	const llenarFormulario = (n) => {
		form.reset();
		campo('tipo').value = n.tipo || 'lanzamiento';
		campo('fecha').value = n.fecha || hoy();
		form.querySelector('input[name="estado"][value="' + (n.estado || 'borrador') + '"]').checked = true;
		campo('titulo').value = n.titulo || '';
		campo('catalogo').value = n.catalogo || '';
		campo('artista').value = n.artista || '';
		campo('subtitulo').value = n.subtitulo || '';
		campo('bandcamp-album').value = (n.bandcamp && n.bandcamp.album) || '';
		campo('bandcamp-url').value = (n.bandcamp && n.bandcamp.url) || '';
		campo('bandcamp-texto').value = (n.bandcamp && n.bandcamp.texto) || '';
		campo('imagen-alt').value = (n.tipo === 'noticia' ? n.imagenAlt : n.portadaAlt) || '';
		campo('enlace').value = n.enlace || '';
		campo('cuerpo-es').value = (n.cuerpo && n.cuerpo.es) || '';
		campo('cuerpo-en').value = (n.cuerpo && n.cuerpo.en) || '';
		$('#embed').value = '';
		$('#imagen-archivo').value = '';
		actualizarTipo();
		mostrarImagenActual(n);
	};

	// Lee el formulario y devuelve la noticia tal como se guardaría
	const leerFormulario = () => {
		const previa = noticiaActual() || {};
		const n = {
			id: estado.editando || estado.idNuevo || '',
			fecha: campo('fecha').value,
			estado: form.querySelector('input[name="estado"]:checked').value,
			tipo: campo('tipo').value,
			titulo: campo('titulo').value.trim()
		};
		const opcional = (clave, valor) => { if (valor.trim()) n[clave] = valor.trim(); };
		if (n.tipo === 'lanzamiento') {
			opcional('subtitulo', campo('subtitulo').value);
			opcional('catalogo', campo('catalogo').value);
			opcional('artista', campo('artista').value);
			const portada = estado.imagen ? estado.imagen.ruta : previa.portada;
			if (portada) {
				n.portada = portada;
				n.portadaAlt = campo('imagen-alt').value.trim();
				const tamanos = estado.imagen ? estado.imagen.tamanos : previa.portadaTamanos;
				if (tamanos && tamanos.length) n.portadaTamanos = tamanos;
			}
			const album = campo('bandcamp-album').value.trim();
			if (album) {
				n.bandcamp = { album: album };
				if (campo('bandcamp-url').value.trim()) n.bandcamp.url = campo('bandcamp-url').value.trim();
				if (campo('bandcamp-texto').value.trim()) n.bandcamp.texto = campo('bandcamp-texto').value.trim();
			}
		} else {
			const imagen = estado.imagen ? estado.imagen.ruta : previa.imagen;
			if (imagen) {
				n.imagen = imagen;
				opcional('imagenAlt', campo('imagen-alt').value);
			}
			opcional('enlace', campo('enlace').value);
		}
		n.cuerpo = {};
		if (campo('cuerpo-es').value.trim()) n.cuerpo.es = campo('cuerpo-es').value.trim();
		if (campo('cuerpo-en').value.trim()) n.cuerpo.en = campo('cuerpo-en').value.trim();
		return n;
	};

	const huella = () => JSON.stringify(leerFormulario()) + (estado.imagen ? estado.imagen.ruta + estado.imagen.archivos.length : '');
	const hayCambios = () => !$('#vista-form').hidden && huella() !== estado.original;

	const editar = (id) => {
		avisar('');
		estado.editando = id || null;
		estado.idNuevo = null;
		estado.imagen = null;
		const n = id ? noticiaActual() : { tipo: 'lanzamiento', fecha: hoy(), estado: 'borrador', cuerpo: {} };
		llenarFormulario(n);
		$('#btn-borrar').hidden = !id;
		estado.original = huella();
		mostrar('form');
		actualizarVista();
		campo('titulo').focus();
	};

	const actualizarTipo = () => {
		form.dataset.tipo = campo('tipo').value;
		$('#leyenda-imagen').textContent = campo('tipo').value === 'noticia' ? 'Imagen (flyer)' : 'Portada';
	};

	const mostrarImagenActual = (n) => {
		const ruta = estado.imagen ? estado.imagen.ruta : (n.tipo === 'noticia' ? n.imagen : n.portada);
		const miniatura = $('#imagen-miniatura');
		let src = '';
		if (estado.imagen) {
			src = estado.imagen.vista;
		} else if (ruta) {
			const tamanos = n.portadaTamanos || [];
			src = /^https:/.test(ruta) ? ruta : SITIO + (tamanos.length ? ruta.replace(/\.jpg$/i, '-' + tamanos[0] + '.jpg') : ruta);
		}
		miniatura.hidden = !src;
		if (src) miniatura.src = src;
		$('#imagen-ruta').textContent = ruta ? ruta + (estado.imagen ? ' (sin guardar)' : '') : 'Sin imagen';
	};

	// Código "Embed" de Bandcamp → ID del álbum, enlace y texto
	$('#embed').addEventListener('input', () => {
		const codigo = $('#embed').value;
		const album = codigo.match(/album=(\d+)/);
		const enlace = codigo.match(/href="(https:[^"]+)"/);
		const texto = codigo.match(/>([^<>]+)<\/a>/);
		if (album) campo('bandcamp-album').value = album[1];
		if (enlace) campo('bandcamp-url').value = enlace[1];
		if (texto) campo('bandcamp-texto').value = texto[1].trim();
		programarVista();
	});

	/* ---------- imágenes: se reducen en el navegador antes de subirlas ---------- */

	const cargarImagen = (archivo) => new Promise((resolver, rechazar) => {
		const img = new Image();
		const url = URL.createObjectURL(archivo);
		img.onload = () => resolver({ img: img, url: url });
		img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen')); };
		img.src = url;
	});

	const reducir = (img, ancho) => new Promise((resolver) => {
		const escala = Math.min(1, ancho / img.naturalWidth);
		const lienzo = document.createElement('canvas');
		lienzo.width = Math.round(img.naturalWidth * escala);
		lienzo.height = Math.round(img.naturalHeight * escala);
		const ctx = lienzo.getContext('2d');
		ctx.fillStyle = '#fff'; // las transparencias quedan en blanco en JPEG
		ctx.fillRect(0, 0, lienzo.width, lienzo.height);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
		lienzo.toBlob((blob) => resolver(blob), 'image/jpeg', CALIDAD_JPEG);
	});

	const aBase64 = (blob) => new Promise((resolver) => {
		const lector = new FileReader();
		lector.onload = () => resolver(String(lector.result).split(',')[1]);
		lector.readAsDataURL(blob);
	});

	$('#imagen-archivo').addEventListener('change', async (evento) => {
		const archivo = evento.target.files[0];
		if (!archivo) return;
		if (!campo('titulo').value.trim()) {
			avisar('Escribe primero el título: se usa para nombrar la imagen.', true);
			evento.target.value = '';
			return;
		}
		avisar('Preparando la imagen…');
		try {
			const { img, url } = await cargarImagen(archivo);
			const id = estado.editando || estado.idNuevo || (estado.idNuevo = idUnico(slug((campo('catalogo').value + ' ' + campo('titulo').value).replace(/\s+ep$/i, ''))));
			let imagen;
			if (campo('tipo').value === 'noticia') {
				const ruta = 'img/flyers/' + id + '.jpg';
				const blob = await reducir(img, ANCHO_FLYER);
				imagen = { ruta: ruta, tamanos: null, archivos: [{ ruta: ruta, base64: await aBase64(blob) }], vista: URL.createObjectURL(blob) };
			} else {
				// No se agranda: solo los tamaños hasta el ancho original (al menos el más chico)
				const tamanos = TAMANOS_PORTADA.filter((t, i) => i === 0 || t <= img.naturalWidth);
				const ruta = 'img/art/' + id + '.jpg';
				const archivos = [];
				let vista = '';
				for (const t of tamanos) {
					const blob = await reducir(img, t);
					archivos.push({ ruta: 'img/art/' + id + '-' + t + '.jpg', base64: await aBase64(blob) });
					if (t <= 1200) vista = URL.createObjectURL(blob);
				}
				imagen = { ruta: ruta, tamanos: tamanos, archivos: archivos, vista: vista };
			}
			URL.revokeObjectURL(url);
			estado.imagen = imagen;
			mostrarImagenActual(leerFormulario());
			const kb = Math.round(imagen.archivos.reduce((s, a) => s + a.base64.length * 0.75, 0) / 1024);
			avisar('Imagen lista (' + imagen.archivos.length + ' tamaños, ' + kb + ' KB en total). Se sube al guardar.');
			actualizarVista();
		} catch (error) {
			avisar(error.message, true);
		}
	});

	/* ---------- vista previa: el mismo código que usa el sitio ---------- */

	const marco = $('#vista-previa');
	let marcoListo = false;
	marco.addEventListener('load', () => { marcoListo = true; actualizarVista(); });

	const cargarScript = (src) => new Promise((resolver) => {
		const script = document.createElement('script');
		script.src = src;
		script.onload = () => resolver(true);
		script.onerror = () => resolver(false);
		document.head.appendChild(script);
	});

	const existe = async (url) => {
		try { return (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { return false; }
	};

	// En Cloudflare, el build copia noticias.js y style.css del sitio a vista/. En local
	// (Live Server) esas copias no existen: se usan los archivos del sitio (../)
	const prepararVistaPrevia = async () => {
		if (!window.AntidataNoticias) await cargarScript('../noticias.js');
		if (!window.AntidataNoticias) return;
		window.AntidataNoticias.activarVistaPrevia();
		const url = (ruta) => new URL(ruta, location.href).href;
		const estilos = (await existe(url('vista/style.css'))) ? url('vista/style.css') : url('../style.css');
		marco.srcdoc = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
			'<base href="' + SITIO + '">' +
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Special+Elite&display=swap">' +
			'<link rel="stylesheet" href="' + url('vista/bootstrap-min.css') + '">' +
			'<link rel="stylesheet" href="' + estilos + '">' +
			'<link rel="stylesheet" href="' + url('vista/vista.css') + '">' +
			'</head><body><div class="accordion accordion-flush" id="accordion"></div></body></html>';
	};

	const actualizarVista = () => {
		if (!marcoListo || !window.AntidataNoticias || $('#vista-form').hidden) return;
		const doc = marco.contentDocument;
		const html = doc.documentElement;
		html.setAttribute('data-force-color-mode', document.documentElement.getAttribute('data-modo-actual'));
		html.setAttribute('lang', estado.idiomaVista);
		html.classList.toggle('en-primero', estado.idiomaVista === 'en');
		const n = leerFormulario();
		const vista = Object.assign({}, n, { id: n.id || 'vista-previa' });
		if (estado.imagen) {
			if (n.tipo === 'noticia') vista.imagen = estado.imagen.vista;
			else { vista.portada = estado.imagen.vista; delete vista.portadaTamanos; }
		}
		const contenedor = doc.getElementById('accordion');
		while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);
		const item = window.AntidataNoticias.crearItem(vista, { abierta: estado.vistaAbierta });
		// Sin reproductores ni otros embeds en el admin: un recuadro en su lugar
		item.querySelectorAll('.reproductor').forEach((r) => {
			r.textContent = '▶ Reproductor de Bandcamp · álbum ' + n.bandcamp.album;
			r.classList.add('reproductor-falso');
		});
		contenedor.appendChild(doc.importNode(item, true));
		const boton = contenedor.querySelector('.accordion-button');
		if (boton) boton.addEventListener('click', () => { estado.vistaAbierta = !estado.vistaAbierta; marcarBotonesVista(); actualizarVista(); });
	};

	let temporizadorVista = null;
	const programarVista = () => { clearTimeout(temporizadorVista); temporizadorVista = setTimeout(actualizarVista, 250); };

	const marcarBotonesVista = () => {
		form.querySelectorAll('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.vista === 'desplegada') === estado.vistaAbierta)));
		form.querySelectorAll('[data-idioma]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.idioma === estado.idiomaVista)));
	};

	form.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
		estado.vistaAbierta = b.dataset.vista === 'desplegada';
		marcarBotonesVista();
		actualizarVista();
	}));
	form.querySelectorAll('[data-idioma]').forEach((b) => b.addEventListener('click', () => {
		estado.idiomaVista = b.dataset.idioma;
		marcarBotonesVista();
		actualizarVista();
	}));
	form.addEventListener('input', programarVista);
	campo('tipo').addEventListener('change', () => { actualizarTipo(); actualizarVista(); });

	/* ---------- guardar / borrar ---------- */

	// Guarda una versión nueva de las noticias. Si alguien más las cambió entretanto,
	// no sobrescribe: carga la versión nueva y pide volver a guardar.
	const enviar = async (noticias, mensaje, archivos) => {
		if (estado.demo) {
			avisar('Modo de prueba local: no se guarda nada. Para guardar, usa el admin en admin.antidata.id.', true);
			return false;
		}
		const r = await api('PUT', 'noticias', {
			sha: estado.sha,
			mensaje: mensaje,
			datos: { version: 1, noticias: noticias },
			archivos: archivos || []
		});
		if (r.ok) {
			estado.sha = r.datos.sha;
			estado.datos = r.datos.datos;
			return true;
		}
		if (r.status === 409) {
			await cargar();
			avisar('Las noticias cambiaron desde que las abriste (otra pestaña o dispositivo). Ya se cargó la versión nueva: revisa y vuelve a guardar.', true);
		} else if (r.status !== 401) {
			avisar(errorDe(r), true);
		}
		return false;
	};

	form.addEventListener('submit', async (evento) => {
		evento.preventDefault();
		const n = leerFormulario();
		if (!n.titulo) { avisar('Falta el título.', true); campo('titulo').focus(); return; }
		if (!/^\d{4}-\d{2}-\d{2}$/.test(n.fecha)) { avisar('Falta la fecha.', true); campo('fecha').focus(); return; }
		const nueva = !estado.editando;
		if (nueva) n.id = estado.idNuevo || idUnico(slug((n.catalogo ? n.catalogo + ' ' : '') + n.titulo.replace(/\s+ep$/i, '')));
		const noticias = estado.datos.noticias.filter((x) => x.id !== n.id);
		const posicion = estado.datos.noticias.findIndex((x) => x.id === n.id);
		noticias.splice(posicion >= 0 ? posicion : 0, 0, n);
		const botones = form.querySelectorAll('.barra-guardar button');
		botones.forEach((b) => { b.disabled = true; });
		avisar('Guardando…');
		const ok = await enviar(noticias, (nueva ? 'crear' : 'editar') + ' «' + n.titulo + '»', estado.imagen ? estado.imagen.archivos : []);
		botones.forEach((b) => { b.disabled = false; });
		if (ok) {
			estado.imagen = null;
			mostrarLista();
			avisar('Guardado. El sitio se actualiza en uno o dos minutos.');
		}
	});

	$('#btn-borrar').addEventListener('click', (evento) => {
		const n = noticiaActual();
		if (!n) return;
		confirmarCon(evento.currentTarget, '¿Borrar? Pulsa otra vez', async () => {
			avisar('Borrando…');
			if (await enviar(estado.datos.noticias.filter((x) => x.id !== n.id), 'borrar «' + n.titulo + '»')) {
				mostrarLista();
				avisar('Borrada. Si fue un error, puedes restaurarla desde el Historial.');
			}
		});
	});

	$('#btn-cancelar').addEventListener('click', () => {
		if (hayCambios() && !$('#btn-cancelar').dataset.confirmando) {
			confirmarCon($('#btn-cancelar'), '¿Descartar cambios? Pulsa otra vez', () => { estado.original = huella(); mostrarLista(); avisar(''); });
			return;
		}
		mostrarLista();
		avisar('');
	});

	// Ctrl+S / Cmd+S guarda
	document.addEventListener('keydown', (evento) => {
		if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's' && !$('#vista-form').hidden) {
			evento.preventDefault();
			form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
		}
	});

	window.addEventListener('beforeunload', (evento) => {
		if (hayCambios()) { evento.preventDefault(); evento.returnValue = ''; }
	});

	/* ---------- historial ---------- */

	const mostrarHistorial = async () => {
		if (estado.demo) { avisar('Modo de prueba local: el historial necesita el servidor.', true); return; }
		avisar('Cargando historial…');
		const r = await api('GET', 'historial');
		if (!r.ok) { if (r.status !== 401) avisar(errorDe(r), true); return; }
		avisar('');
		const lista = $('#historial');
		while (lista.firstChild) lista.removeChild(lista.firstChild);
		r.datos.cambios.forEach((c, i) => {
			const li = document.createElement('li');
			const fila = document.createElement('div');
			fila.className = 'fila-historial';
			const texto = document.createElement('span');
			texto.textContent = fechaLegible(c.fecha) + ' · ' + c.mensaje;
			fila.appendChild(texto);
			if (i > 0) {
				const boton = document.createElement('button');
				boton.type = 'button';
				boton.textContent = 'Restaurar';
				boton.addEventListener('click', () => confirmarCon(boton, '¿Restaurar? Pulsa otra vez', async () => {
					avisar('Restaurando…');
					const res = await api('POST', 'restaurar', { commit: c.commit, sha: estado.sha });
					if (res.ok) {
						estado.sha = res.datos.sha;
						estado.datos = res.datos.datos;
						mostrarLista();
						avisar('Restaurada la versión del ' + fechaLegible(c.fecha) + '. El sitio se actualiza en uno o dos minutos.');
					} else if (res.status === 409) {
						await cargar();
						avisar('Las noticias cambiaron mientras tanto. Vuelve a intentarlo.', true);
					} else if (res.status !== 401) {
						avisar(errorDe(res), true);
					}
				}));
				fila.appendChild(boton);
			} else {
				const actual = document.createElement('span');
				actual.className = 'etiqueta';
				actual.textContent = 'actual';
				fila.appendChild(actual);
			}
			li.appendChild(fila);
			lista.appendChild(li);
		});
		mostrar('historial');
	};

	/* ---------- sesión y navegación ---------- */

	$('#form-login').addEventListener('submit', async (evento) => {
		evento.preventDefault();
		const r = await api('POST', 'login', { clave: $('#clave').value });
		if (r.ok) {
			$('#clave').value = '';
			avisar('');
			if (await cargar()) mostrarLista();
		} else if (r.status === 429) {
			avisar('Demasiados intentos. Espera ' + Math.ceil((r.datos.espera || 900) / 60) + ' minutos.', true);
		} else {
			avisar(r.datos.error || 'No se pudo entrar', true);
		}
	});

	$('#btn-nueva').addEventListener('click', () => editar(null));
	$('#btn-historial').addEventListener('click', mostrarHistorial);
	$('#btn-volver-historial').addEventListener('click', mostrarLista);
	$('#btn-salir').addEventListener('click', async () => {
		if (estado.demo) { avisar(''); return; }
		await api('POST', 'logout');
		mostrar('login');
		avisar('');
	});

	$('#btn-tema').addEventListener('click', () => {
		const html = document.documentElement;
		const modo = html.getAttribute('data-modo-actual') === 'dark' ? 'light' : 'dark';
		html.setAttribute('data-force-color-mode', modo);
		html.setAttribute('data-modo-actual', modo);
		try { window.localStorage.setItem('color-mode', modo); } catch (e) {}
		actualizarVista();
	});

	(async () => {
		await prepararVistaPrevia();
		if (await cargar()) mostrarLista();
		else if ($('#vista-lista').hidden) mostrar('login');
	})();

})();
