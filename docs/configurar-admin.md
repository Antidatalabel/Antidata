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

> **Cómo encontrar los menús de Cloudflare.** El panel cambia de nombres y de lugar seguido.
> Si un menú no aparece donde dice esta guía, usa el **buscador** de arriba del panel
> (lupa o **Ctrl+K**) y escribe el nombre en inglés: `Workers & Pages` o `KV`. Los nombres
> de botones de esta guía están revisados con la documentación oficial de Cloudflare.

## Paso 3 — Espacio KV

1. Entra a <https://dash.cloudflare.com> y elige tu cuenta.
2. Abre la página **Workers KV**: en el menú izquierdo suele estar dentro de
   **Storage & databases**; si no la ves, búscala con Ctrl+K escribiendo `KV`.
3. Botón **Create instance** (en versiones anteriores del panel: *Create a namespace*).
4. Nombre: `antidata-admin-intentos` → **Create**.

## Paso 4 — Proyecto de Pages para el admin

1. Abre la página **Workers & Pages** (menú izquierdo, a veces dentro de **Compute**;
   o Ctrl+K → `Workers & Pages`). Ahí ya está tu proyecto `antidata`.
2. Botón **Create application** → elige **Pages** (no *Workers*) → **Connect to Git**.
   - Si solo ves opciones de *Workers*, busca en esa misma pantalla el enlace
     **Pages** o *Looking to deploy Pages?*.
3. Elige la cuenta de GitHub y el repo `Antidatalabel/Antidata` → **Begin setup**.
   (Si GitHub pide permisos, **Install & Authorize** con acceso a ese repo.)
4. En **Set up builds and deployments** completa:
   - **Project name:** `antidata-admin`
   - **Production branch:** `main`
   - **Framework preset:** *None*
   - **Build command:** `cp ../style.css ../noticias.js vista/`
   - **Build output directory:** `.`
   - Despliega **Root directory (advanced)** → **Path:** `admin`
   - **Environment variables (optional):** déjalo vacío; se agregan en el paso 5.
5. **Save and Deploy**. **Este primer deploy va a fallar** (en `main` todavía no existe la
   carpeta `admin/`). Es lo esperado: el proyecto queda creado igual.

## Paso 5 — Variables y secretos

1. **Workers & Pages** → proyecto `antidata-admin` → pestaña **Settings**.
2. Arriba de Settings hay un selector de entorno (**Production** / **Preview**). Empieza con
   **Production**.
3. Sección **Variables and Secrets** → **Add**. Por cada fila de la tabla: escribe el nombre
   y el valor; en las de tipo *Secret* elige el tipo **Secret** (o marca **Encrypt**, según
   cómo lo muestre tu panel). Al terminar, **Save**.
4. Cambia el selector a **Preview** y repítelas (con `GITHUB_BRANCH` = `dev-newsmgmt`).

| Nombre | Tipo | Valor en Production | Valor en Preview |
|---|---|---|---|
| `ADMIN_PASSWORD_HASH` | **Secret** | el valor del paso 2 | el mismo |
| `SESSION_SECRET` | **Secret** | el valor del paso 2 | el mismo |
| `GITHUB_TOKEN` | **Secret** | el token del paso 1 | el mismo |
| `GITHUB_REPO` | Text | `Antidatalabel/Antidata` | el mismo |
| `GITHUB_BRANCH` | Text | `main` | `dev-newsmgmt` |
| `COMMIT_AUTOR_NOMBRE` | Text | `zetor` | el mismo |
| `COMMIT_AUTOR_EMAIL` | Text | `268057403+Antidatalabel@users.noreply.github.com` | el mismo |

Copia y pega los valores sin espacios al principio ni al final.

## Paso 6 — Conectar el KV

1. Mismo proyecto → **Settings** → sección **Bindings** → **Add** → **KV namespace**.
2. **Variable name:** `INTENTOS` (en mayúsculas, exactamente así).
3. **KV namespace:** elige `antidata-admin-intentos` → **Save**.
4. Repite con el selector de entorno en **Preview**.

## Paso 7 — Subdominio admin.antidata.id (después del merge a `main`)

1. Proyecto `antidata-admin` → pestaña **Custom domains** → **Set up a domain**.
2. Escribe `admin.antidata.id` → **Continue**.
3. Confirma el registro DNS (**Activate domain**). Como el DNS de antidata.id está en
   Cloudflare, el registro `CNAME` se crea solo. Tarda unos minutos en quedar *Active*.

## Paso 8 — Ajustes del proyecto del sitio público (`antidata`)

Para que el sitio no publique las carpetas del admin y no se reconstruya cuando solo cambia el admin:

1. **Workers & Pages** → proyecto `antidata` → **Settings** → sección **Build** →
   **Build configuration** → **Edit**:
   - **Build command:** `rm -rf admin herramientas docs README.md`
   - **Build output directory:** `/` (déjalo como está si ya es así)
   → **Save**.
2. Misma sección **Build** → **Build watch paths** → **Edit** → **Exclude paths:**
   `admin/*`, `herramientas/*`, `docs/*`, `README.md` → **Save**.

Y en el proyecto `antidata-admin` → **Settings** → **Build** → **Build watch paths** → **Include paths:**
`admin/*`, `noticias.js`, `style.css` (así no se reconstruye con cada noticia nueva).

## Paso 9 — Volver a publicar y probar

1. Proyecto `antidata-admin` → pestaña **Deployments** → en el último deploy, menú **⋯**
   (tres puntos) → **Retry deployment** (para que tome las variables y el KV).
2. Abre <https://admin.antidata.id> y entra con tu contraseña.
3. Sigue la lista de pruebas manuales de [README.md](../README.md).

## Opcional — Cerrar las URLs de prueba

Cloudflare también publica el admin en direcciones `*.antidata-admin.pages.dev`. Igual piden
contraseña, pero si quieres que nadie más pueda ni siquiera verlas, puedes protegerlas con
**Cloudflare Access** (gratis hasta 50 usuarios): proyecto → **Settings** → **General** →
**Access policy** → **Enable**.
