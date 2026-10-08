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

mediaQuery.addEventListener('change', () => {
	if (document.documentElement.getAttribute('data-force-color-mode')) {
		return;
	}
	toggle.checked = mediaQuery.matches;
});

// Estado inicial del interruptor (el atributo ya se aplicó en el <head>)
const colorModeOverride = leerModoGuardado();
toggle.checked = colorModeOverride ? (colorModeOverride === 'dark') : mediaQuery.matches;

if (!navigator.language.toLowerCase().startsWith('es')) {
	document.documentElement.classList.add('en-primero');
}
