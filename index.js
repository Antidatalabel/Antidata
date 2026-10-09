const toggle = document.querySelector('#toggle-darkmode');
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const leerModoGuardado = () => {
	try {
		return window.localStorage.getItem('color-mode');
	} catch (e) {
		return null;
	}
};

const setColorMode = (mode) => {

	if (mode) {
		document.documentElement.setAttribute('data-force-color-mode', mode);
		try { window.localStorage.setItem('color-mode', mode); } catch (e) {}
		toggle.checked = (mode === 'dark');
	}
	else {
		document.documentElement.removeAttribute('data-force-color-mode');
		try { window.localStorage.removeItem('color-mode'); } catch (e) {}
		toggle.checked = mediaQuery.matches;
	}
}

// Si el modo elegido coincide con el del sistema, se borra la preferencia guardada
// y la página vuelve a seguir la configuración del usuario
toggle.addEventListener('click', (e) => {
	const modo = e.target.checked ? 'dark' : 'light';
	const modoSistema = mediaQuery.matches ? 'dark' : 'light';
	setColorMode(modo === modoSistema ? null : modo);
});

const alCambiarModoSistema = () => {
	if (document.documentElement.getAttribute('data-force-color-mode')) {
		return;
	}
	toggle.checked = mediaQuery.matches;
};

// Safari/iOS < 14 solo soporta addListener en matchMedia
if (mediaQuery.addEventListener) {
	mediaQuery.addEventListener('change', alCambiarModoSistema);
} else {
	mediaQuery.addListener(alCambiarModoSistema);
}

// Estado inicial del interruptor (el atributo ya se aplicó en el <head>)
const colorModeOverride = leerModoGuardado();
toggle.checked = colorModeOverride ? (colorModeOverride === 'dark') : mediaQuery.matches;

// El idioma inicial (clase en-primero y lang de <html>) se aplica en el <head>

// Selector de idioma del manifiesto: al hacer clic en ES o EN, ese idioma se muestra
// de inmediato en el manifiesto y en las noticias, y el ciclo de 28s del manifiesto
// se reinicia para darle su tiempo completo de lectura
const animacionesIdioma = {
	es: document.querySelectorAll('.manifiesto-texto[lang="es"], .manifiesto-idiomas .idioma-es'),
	en: document.querySelectorAll('.manifiesto-texto[lang="en"], .manifiesto-idiomas .idioma-en')
};

const reiniciarAnimacion = (elementos, retraso) => {
	elementos.forEach((el) => {
		el.style.animationName = 'none';
		void el.offsetWidth; // fuerza al navegador a aplicar el cambio antes de reactivarla
		el.style.animationDelay = retraso;
		el.style.animationName = '';
	});
};

const mostrarIdioma = (idioma) => {
	const otro = idioma === 'es' ? 'en' : 'es';
	const html = document.documentElement;
	// Esta clase marca el idioma activo: decide qué idioma se ve en las noticias
	// y, con movimiento reducido (sin animación), también en el manifiesto
	html.classList.toggle('en-primero', idioma === 'en');
	html.setAttribute('lang', idioma);
	// Se recuerda la elección; si coincide con el idioma del navegador se borra,
	// para que la página vuelva a seguir la configuración del usuario
	try {
		if (idioma === html.getAttribute('data-idioma-navegador')) {
			window.localStorage.removeItem('idioma');
		} else {
			window.localStorage.setItem('idioma', idioma);
		}
	} catch (e) {}
	// -1s salta el fundido de entrada (1s) para que aparezca ya visible;
	// el otro idioma va medio ciclo (14s) detrás
	reiniciarAnimacion(animacionesIdioma[idioma], '-1s');
	reiniciarAnimacion(animacionesIdioma[otro], '-15s');
	// Avisa a las noticias (textos de la paginación)
	document.dispatchEvent(new CustomEvent('antidata:idioma', { detail: { idioma: idioma } }));
};

document.querySelectorAll('.manifiesto-idiomas button').forEach((boton) => {
	boton.addEventListener('click', () => mostrarIdioma(boton.dataset.idioma));
});
