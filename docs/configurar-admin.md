# Configurar el admin de noticias (admin.antidata.id)

Esto se hace **una sola vez**. Son unos 20 minutos. No hace falta instalar nada.

> **Antes de empezar:** el admin guarda las noticias en la rama `main`. Primero hay que
> hacer merge de `dev-newsmgmt` a `main`, porque ahí está el código nuevo del sitio
> (`noticias.js` y `data/news.json`). Si lo configuras antes, el admin funciona, pero el
> sitio publicado todavía no leería las noticias desde el archivo.

## Qué vas a crear

| Pieza | Para qué sirve |
|---|---|
| Un **token de GitHub** | La llave con la que el admin hace commit de `data/news.json` en tu repo. Solo sirve para este repo y solo para su contenido. |
| La **contraseña del admin** (como hash) | Tu contraseña, guardada de forma que nadie pueda leerla, ni siquiera desde Cloudflare. |
| Un **espacio KV** | Una pequeña libreta donde Cloudflare anota los intentos fallidos de entrar (ver abajo). |
| Un **segundo proyecto en Cloudflare Pages** | Publica la carpeta `admin/` en `admin.antidata.id`, separada del sitio. |

### ¿Qué es KV?

Workers KV es un almacén de datos muy simple de Cloudflare: guarda pares "clave → valor".
El admin lo usa solo para contar intentos de contraseña por dirección IP: después de **5
intentos fallidos**, esa IP queda **bloqueada 15 minutos**. Así nadie puede probar miles de
contraseñas. Las anotaciones se borran solas al cabo de una hora. El plan gratuito permite
1.000 escrituras al día, mucho más de lo que se va a usar. Tú solo tienes que crearlo y
conectarlo (pasos 3 y 6); no tienes que tocarlo nunca más.

## Paso 1 — Token de GitHub

1. Entra a GitHub con la cuenta **Antidatalabel**.
2. Arriba a la derecha: foto de perfil → **Settings** → abajo a la izquierda **Developer settings**
   → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Completa:
   - **Token name:** `antidata-admin`
   - **Expiration:** 1 año (anótalo en tu calendario para renovarlo; ver el README)
   - **Resource owner:** `Antidatalabel`
   - **Repository access:** *Only select repositories* → `Antidata`
   - **Permissions → Repository permissions → Contents:** *Read and write*
     (GitHub agrega solo *Metadata: Read-only*; está bien)
4. **Generate token** y **copia el token** (empieza con `github_pat_`). GitHub no lo vuelve a mostrar.
   Guárdalo un momento en un lugar seguro; lo vas a pegar en el paso 5.

> Si `main` tiene una regla de protección que exige pull requests, el admin no podrá hacer
> commit. En ese caso avísame.

## Paso 2 — Contraseña del admin

1. En la carpeta del proyecto, abre `herramientas`.
2. Clic derecho en `generar-hash.ps1` → **Ejecutar con PowerShell**.
   (Si Windows lo bloquea, abre PowerShell en la carpeta del proyecto y escribe:
   `powershell -ExecutionPolicy Bypass -File herramientas\generar-hash.ps1`)
3. Escribe la contraseña nueva dos veces (mínimo 12 caracteres; mejor una frase larga).
4. El script muestra dos valores. Cópialos:
   - `ADMIN_PASSWORD_HASH` (empieza con `pbkdf2$100000$`)
   - `SESSION_SECRET`

La contraseña en sí no se guarda en ningún lado: si la olvidas, se genera otra con este mismo script.

## Paso 3 — Espacio KV

1. Entra a <https://dash.cloudflare.com> → menú izquierdo **Storage & Databases** → **KV**
   (en algunas cuentas aparece como **Workers & Pages → KV**).
2. **Create a namespace** → nombre: `antidata-admin-intentos` → **Add**.

## Paso 4 — Proyecto de Pages para el admin

1. **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
2. Elige el repo `Antidatalabel/Antidata` → **Begin setup**.
3. Completa:
   - **Project name:** `antidata-admin`
   - **Production branch:** `main`
   - **Framework preset:** *None*
   - **Build command:** `cp ../style.css ../noticias.js vista/`
   - **Build output directory:** `.`
   - **Root directory (advanced):** `admin`
4. **Save and Deploy**. El primer deploy puede fallar o mostrar el aviso de configuración
   incompleta: es normal, faltan los pasos 5 y 6.

## Paso 5 — Variables y secretos

En el proyecto `antidata-admin` → **Settings** → **Variables and Secrets** → **Add**.
Agrega estas, en **Production** (y repítelas en **Preview** si quieres probar con ramas):

| Nombre | Tipo | Valor |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | **Secret** | el valor del paso 2 |
| `SESSION_SECRET` | **Secret** | el valor del paso 2 |
| `GITHUB_TOKEN` | **Secret** | el token del paso 1 |
| `GITHUB_REPO` | Text | `Antidatalabel/Antidata` |
| `GITHUB_BRANCH` | Text | `main` (en Preview: `dev-newsmgmt`, para probar sin tocar el sitio) |
| `COMMIT_AUTOR_NOMBRE` | Text | `zetor` |
| `COMMIT_AUTOR_EMAIL` | Text | `268057403+Antidatalabel@users.noreply.github.com` |

## Paso 6 — Conectar el KV

En el mismo proyecto → **Settings** → **Bindings** (o **Functions → KV namespace bindings**)
→ **Add** → **KV namespace**:
- **Variable name:** `INTENTOS`
- **KV namespace:** `antidata-admin-intentos`

Hazlo en Production y en Preview.

## Paso 7 — Subdominio admin.antidata.id

En el proyecto `antidata-admin` → **Custom domains** → **Set up a custom domain** →
`admin.antidata.id` → **Continue** → **Activate domain**. Como tu DNS ya está en Cloudflare,
el registro se crea solo. Tarda unos minutos.

## Paso 8 — Ajustes del proyecto del sitio público (`antidata`)

Para que el sitio no publique las carpetas del admin y no se reconstruya cuando solo cambia el admin:

1. Proyecto `antidata` → **Settings** → **Build** → **Build configuration** → **Edit**:
   - **Build command:** `rm -rf admin herramientas docs`
   - **Build output directory:** `/` (déjalo como está si ya es así)
2. **Settings** → **Build** → **Build watch paths** → **Exclude paths:** `admin/*`, `herramientas/*`, `docs/*`

Y en el proyecto `antidata-admin` → **Build watch paths** → **Include paths:**
`admin/*`, `noticias.js`, `style.css` (así no se reconstruye con cada noticia nueva).

## Paso 9 — Volver a publicar y probar

1. Proyecto `antidata-admin` → **Deployments** → en el último → **⋯** → **Retry deployment**
   (para que tome las variables y el KV).
2. Abre <https://admin.antidata.id> y entra con tu contraseña.
3. Sigue la lista de pruebas manuales del README.

## Opcional — Cerrar las URLs de prueba

Cloudflare también publica el admin en direcciones `*.antidata-admin.pages.dev`. Igual piden
contraseña, pero si quieres que nadie más pueda ni siquiera verlas, puedes protegerlas con
**Cloudflare Access** (gratis hasta 50 usuarios): proyecto → **Settings** → **General** →
**Access policy** → **Enable**.
