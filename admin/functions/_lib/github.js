/* Acceso a GitHub para leer y guardar data/news.json (y las imágenes subidas).
   Variables: GITHUB_TOKEN (secreto), GITHUB_REPO ("usuario/repo"), GITHUB_BRANCH,
   COMMIT_AUTOR_NOMBRE y COMMIT_AUTOR_EMAIL.
   Cada guardado es un solo commit con todos sus archivos (Git Data API). Antes de
   escribir se comprueba que news.json no cambió desde que el admin lo leyó (sha). */

export const RUTA_NOTICIAS = 'data/news.json';

export class Conflicto extends Error {}

const enc = new TextEncoder();

export const textoABase64 = (texto) => {
	const bytes = enc.encode(texto);
	let binario = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
	}
	return btoa(binario);
};

export const base64ATexto = (base64) => new TextDecoder().decode(
	Uint8Array.from(atob(String(base64).replace(/\s/g, '')), (c) => c.charCodeAt(0)));

const rama = (env) => env.GITHUB_BRANCH || 'main';

const gh = async (env, ruta, opciones = {}) => {
	const respuesta = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/${ruta}`, {
		method: opciones.method || 'GET',
		headers: {
			'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'antidata-admin',
			...(opciones.body ? { 'Content-Type': 'application/json' } : {})
		},
		body: opciones.body ? JSON.stringify(opciones.body) : undefined
	});
	if (!respuesta.ok) {
		const error = new Error(`GitHub ${respuesta.status} en ${ruta}`);
		error.status = respuesta.status;
		throw error;
	}
	return respuesta.status === 204 ? null : respuesta.json();
};

const autor = (env) => ({
	name: env.COMMIT_AUTOR_NOMBRE || 'zetor',
	email: env.COMMIT_AUTOR_EMAIL || '268057403+Antidatalabel@users.noreply.github.com',
	date: new Date().toISOString()
});

// news.json en la punta de la rama (o en un commit concreto)
export const leerNoticias = async (env, ref) => {
	const archivo = await gh(env, `contents/${RUTA_NOTICIAS}?ref=${encodeURIComponent(ref || rama(env))}`);
	return { sha: archivo.sha, datos: JSON.parse(base64ATexto(archivo.content)) };
};

/* Un commit con varios archivos. archivos: [{ ruta, base64 }]. shaEsperado: sha de
   news.json que el admin tenía al empezar a editar. Lanza Conflicto si no coincide
   o si la rama avanzó mientras se guardaba. */
export const guardarArchivos = async (env, archivos, mensaje, shaEsperado) => {
	const referencia = await gh(env, `git/ref/heads/${encodeURIComponent(rama(env))}`);
	const padre = referencia.object.sha;
	const actual = await leerNoticias(env, padre);
	if (actual.sha !== shaEsperado) throw new Conflicto('news.json cambió desde que se cargó');

	const commitPadre = await gh(env, `git/commits/${padre}`);
	const arbol = [];
	for (const archivo of archivos) {
		const blob = await gh(env, 'git/blobs', { method: 'POST', body: { content: archivo.base64, encoding: 'base64' } });
		arbol.push({ path: archivo.ruta, mode: '100644', type: 'blob', sha: blob.sha });
	}
	const nuevoArbol = await gh(env, 'git/trees', { method: 'POST', body: { base_tree: commitPadre.tree.sha, tree: arbol } });
	const firma = autor(env);
	const commit = await gh(env, 'git/commits', {
		method: 'POST',
		body: { message: mensaje, tree: nuevoArbol.sha, parents: [padre], author: firma, committer: firma }
	});
	try {
		// force:false: si alguien hizo commit en la rama mientras tanto, GitHub lo rechaza
		await gh(env, `git/refs/heads/${encodeURIComponent(rama(env))}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
	} catch (error) {
		if (error.status === 422 || error.status === 409) throw new Conflicto('la rama cambió mientras se guardaba');
		throw error;
	}
	const guardado = await leerNoticias(env, commit.sha);
	return { commit: commit.sha, sha: guardado.sha };
};

// Últimos cambios de news.json
export const historial = async (env, cantidad = 20) => {
	const commits = await gh(env, `commits?path=${encodeURIComponent(RUTA_NOTICIAS)}&sha=${encodeURIComponent(rama(env))}&per_page=${cantidad}`);
	return commits.map((c) => ({
		commit: c.sha,
		fecha: c.commit.author && c.commit.author.date,
		mensaje: String(c.commit.message || '').split('\n')[0]
	}));
};
