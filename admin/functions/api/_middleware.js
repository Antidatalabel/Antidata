/* Se ejecuta antes de cada /api/*:
   - Las peticiones que modifican algo deben venir del propio admin (cabecera Origin).
   - Todo, salvo /api/login, exige una sesión válida. */

import { origenValido, sesionValida } from '../_lib/auth.js';
import { json } from '../_lib/respuesta.js';

const configuracionCompleta = (env) =>
	!!(env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET && env.GITHUB_TOKEN && env.GITHUB_REPO && env.INTENTOS);

export const onRequest = async (context) => {
	const { request, env } = context;
	if (!configuracionCompleta(env)) {
		return json({ error: 'Falta configurar el admin (secretos o KV). Revisa el README.' }, 500);
	}
	if (request.method !== 'GET' && !origenValido(request)) {
		return json({ error: 'Origen no permitido' }, 403);
	}
	const ruta = new URL(request.url).pathname;
	if (ruta !== '/api/login' && !(await sesionValida(request, env))) {
		return json({ error: 'Sesión no válida' }, 401);
	}
	return context.next();
};
