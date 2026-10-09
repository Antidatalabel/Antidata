# antidata.id

Sitio del sello ANTIDATA. HTML, CSS y JS sin build, publicado con Cloudflare Pages
desde la rama `main`. Las noticias viven en `data/news.json` y se editan desde
**https://admin.antidata.id**. La configuración inicial del admin está en
[docs/configurar-admin.md](docs/configurar-admin.md).

## Publicar una noticia

1. Entra a https://admin.antidata.id con la contraseña.
2. **Nueva** → elige *Lanzamiento* o *Noticia*. La fecha de hoy ya viene puesta.
3. Completa título y texto (ES y/o EN). Para Bandcamp, pega el código **Embed** del álbum:
   rellena solo el ID, el enlace y el texto.
4. **Portada:** elige la imagen (cualquier tamaño). El admin la reduce sola.
5. Revisa la **vista previa** (plegada/desplegada, ES/EN).
6. Marca **Publicada** (o déjala en *Borrador* para seguir otro día) y **Guardar** (Ctrl+S).
7. El sitio se actualiza en uno o dos minutos (Cloudflare reconstruye al recibir el commit).

Formato del texto: una línea en blanco entre párrafos, `**negrita**`, `*cursiva*`,
`[texto](https://enlace)`. Nada de HTML.

**Deshacer:** *Historial* → *Restaurar* en la versión anterior. Restaurar no borra nada:
crea un cambio nuevo, así que también se puede deshacer.

## Cambiar la contraseña

1. Ejecuta `herramientas/generar-hash.ps1` (clic derecho → *Ejecutar con PowerShell*).
2. Cloudflare → proyecto **antidata-admin** → *Settings* → *Variables and Secrets* →
   edita `ADMIN_PASSWORD_HASH` con el valor nuevo.
3. *Deployments* → *Retry deployment* en el último.

Para además cerrar todas las sesiones abiertas, reemplaza también `SESSION_SECRET` con el
segundo valor que muestra el script.

## Rotar el token de GitHub (cada año, o si se filtró)

1. GitHub (cuenta Antidatalabel) → *Settings* → *Developer settings* → *Fine-grained tokens*
   → `antidata-admin` → **Regenerate token** (mismo acceso: solo el repo `Antidata`,
   *Contents: Read and write*). Copia el token nuevo.
2. Cloudflare → **antidata-admin** → *Variables and Secrets* → edita `GITHUB_TOKEN`.
3. *Retry deployment*. El token anterior deja de funcionar al regenerarlo.

Si el admin muestra "No se pudo leer news.json desde GitHub", lo más probable es que el
token haya vencido.

## DNS del subdominio admin.antidata.id

No hay que tocar el DNS a mano. En Cloudflare → **antidata-admin** → *Custom domains* →
*Set up a custom domain* → `admin.antidata.id`. Como el DNS de antidata.id está en
Cloudflare, se crea solo un registro `CNAME admin → antidata-admin.pages.dev` (con proxy).
Si alguna vez se borra, se recrea igual: en *DNS* → *Add record* → tipo `CNAME`, nombre
`admin`, destino `antidata-admin.pages.dev`, proxy activado.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html`, `index.js`, `style.css` | El sitio |
| `noticias.js` | Dibuja y pagina las noticias desde `data/news.json` |
| `data/news.json` | Las noticias (lo escribe el admin; no editar a mano en otras ramas) |
| `img/art/` | Portadas; `x-64.jpg` … `x-2000.jpg` son las versiones reducidas |
| `admin/` | El admin (proyecto aparte en Cloudflare, con sus funciones en `admin/functions/`) |
| `herramientas/` | Script para generar el hash de la contraseña |

Para ver el sitio en local, usa Live Server: las noticias se leen con `fetch` y no cargan
abriendo el archivo directo. `admin/` en Live Server abre un modo de prueba que no guarda.

## Pruebas manuales

**Sitio público, en Live Server** (antes de mergear):
- [ ] Las 3 noticias aparecen igual que antes: textos, portadas, reproductores, año.
- [ ] Plegar y desplegar funciona; con 1 a 3 noticias empiezan todas abiertas.
- [ ] El selector ES / EN cambia manifiesto y noticias; al recargar se mantiene la elección.
- [ ] Modo claro/oscuro: noticias, chevrons y reproductor se ven bien.
- [ ] Móvil (o DevTools en modo iPhone/iPad): portadas al ancho del reproductor, sin cortes.
- [ ] Sin JavaScript (DevTools → desactivar JS): aparece el aviso con enlace a Bandcamp.

**Sitio público, ya publicado** (en antidata.id, con el paso 8 de la configuración hecho;
en Live Server estas dos no se pueden probar porque ahí se ven todos los archivos):
- [ ] `antidata.id/robots.txt` muestra texto (`User-agent: *`), no la página.
- [ ] `antidata.id/admin/` **no** muestra el formulario de contraseña del admin. Lo normal
      es que muestre la portada del sitio (Cloudflare muestra la portada en las direcciones
      que no existen). Si aparece "ATD · noticias", revisa el paso 8.

**Admin, ya publicado** (primero en la versión de prueba
`dev-newsmgmt.antidata-admin.pages.dev` con `GITHUB_BRANCH=dev-newsmgmt` en Preview, y al
final en admin.antidata.id):
- [ ] Sin sesión pide contraseña; una incorrecta da error; la correcta entra.
- [ ] 5 contraseñas incorrectas seguidas bloquean 15 minutos.
- [ ] Crear una noticia en **Borrador** con portada: el commit aparece en GitHub con autor
      `zetor`, con `news.json` y 5 imágenes; la noticia **no** aparece en el sitio.
- [ ] Pasarla a **Publicada**: aparece en el sitio en uno o dos minutos.
- [ ] Editar desde el teléfono y guardar.
- [ ] Abrir el admin en dos pestañas, guardar en una y luego en la otra: la segunda avisa
      del conflicto y no pisa el cambio.
- [ ] Borrarla (pide confirmación) y restaurarla desde Historial.
- [ ] Salir: vuelve a pedir contraseña.
- [ ] `admin.antidata.id/_lib/auth` y `admin.antidata.id/functions/...` dan 404.
- [ ] `admin.antidata.id/robots.txt` dice `Disallow: /`.
- [ ] La cookie en DevTools → *Application* → *Cookies* es `__Host-atd_sesion` con
      *HttpOnly*, *Secure* y *SameSite Strict*.
