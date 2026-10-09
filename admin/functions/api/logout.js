import { cookieCerrada } from '../_lib/auth.js';
import { json } from '../_lib/respuesta.js';

// POST /api/logout → borra la cookie de sesión
export const onRequestPost = () => json({ ok: true }, 200, { 'Set-Cookie': cookieCerrada() });
