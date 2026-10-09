// Aplica el modo claro/oscuro guardado antes de pintar (en un archivo aparte porque
// la política de seguridad del admin no permite scripts en línea)
(function () {
	var html = document.documentElement;
	try {
		var guardado = window.localStorage.getItem('color-mode');
		if (guardado === 'dark' || guardado === 'light') html.setAttribute('data-force-color-mode', guardado);
	} catch (e) {}
	var oscuro = html.getAttribute('data-force-color-mode')
		? html.getAttribute('data-force-color-mode') === 'dark'
		: window.matchMedia('(prefers-color-scheme: dark)').matches;
	html.setAttribute('data-modo-actual', oscuro ? 'dark' : 'light');
})();
