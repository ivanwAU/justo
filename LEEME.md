# Justo v2 en tres idiomas (español, English, Português): guía para publicarlo

Justo es un sitio estático: no tiene servidor, ni cuentas, ni base de datos. Lo que la persona escribe se guarda solo en su propio dispositivo. Esta carpeta es todo lo que hay que publicar.

**En una frase:** copias estos archivos a la carpeta de tu repositorio `justo`, los subes con GitHub Desktop (commit y *Push origin*), activas GitHub Pages una sola vez y el sitio queda en https://ivanwau.github.io/justo

Si nunca has usado GitHub, sigue la sección **"Publicar paso a paso"** en orden y no te saltes nada. Calcula unos 20 minutos la primera vez; las siguientes veces son 3 minutos.

---

## 1. Qué hay en el zip

| Archivo o carpeta | Para qué sirve |
|---|---|
| `index.html` | La página. |
| `styles.css` | El diseño. |
| `app.js` | La lógica (cuestionario, colchón de dinero, plan, buscador, cambio de idioma). |
| `config.js` | **El único archivo que tocas para activar los comentarios privados.** |
| `data/es.json`, `data/en.json`, `data/pt.json` | Todo el texto en cada idioma: tareas, enlaces, glosario, frases y mensajes. |
| `sw.js` | Modo sin conexión: la app abre aunque no haya internet o la señal sea mala. |
| `manifest.webmanifest` y `icons/` | Permiten "Agregar a pantalla de inicio" con el ícono de Justo. |
| `LEEME.md` | Esta guía. No hace falta subirla, pero no molesta. |

---

## 2. Publicar paso a paso (GitHub Desktop)

### Lo que necesitas antes de empezar

- Una cuenta de GitHub (la tuya es `ivanwAU`).
- La aplicación **GitHub Desktop** instalada y con tu sesión iniciada. Si te pide iniciar sesión: **File → Options → Accounts** (Windows) o **GitHub Desktop → Settings → Accounts** (Mac), y pulsa *Sign in*.
- Tu repositorio **`justo`** ya clonado en el computador (es lo que hiciste antes). Para comprobarlo: arriba a la izquierda de GitHub Desktop debe decir **Current repository: justo**.
- El repositorio debe ser **público**. Con una cuenta gratuita, GitHub Pages solo funciona con repositorios públicos. Se ve en github.com/ivanwAU/justo: junto al nombre aparece la etiqueta *Public*.

> **¿No tienes el repositorio todavía?** En github.com pulsa el botón verde **New** (o el **+** de arriba a la derecha → *New repository*). Nombre: `justo`. Márcalo como **Public**. Pulsa *Create repository*. Luego, en GitHub Desktop: **File → Clone repository → pestaña GitHub.com → elige `justo` → Clone**. Recuerda dónde lo guarda.

### Parte A. Poner los archivos nuevos en tu repositorio

1. **Descomprime el zip.**
   - Windows: clic derecho sobre el zip → *Extraer todo…* → *Extraer*.
   - Mac: doble clic sobre el zip.
   Se crea una carpeta con estos archivos y carpetas adentro (`index.html`, `app.js`, `data`, `icons`, etc.).

2. **Abre la carpeta de tu repositorio.** En GitHub Desktop, menú **Repository → Show in Explorer** (Windows) o **Show in Finder** (Mac). Se abre la carpeta del repositorio `justo`. Déjala abierta.

3. **Borra lo de la versión anterior.** Dentro de esa carpeta, borra los archivos y las carpetas de la v1: `index.html`, `styles.css`, `app.js`, `es.json` (si existe), y la carpeta `content` o `Content` (con mayúscula o minúscula). Si no estás seguro de qué es qué, borra todo **excepto**:
   - la carpeta `.git` (es **oculta**; si la ves, **no la toques**: ahí vive el historial del repositorio),
   - `README.md` y `LICENSE`, si existen (puedes dejarlos).

   *Por qué se borra:* la v2 usa una carpeta llamada `data`. Si queda una `content` vieja, GitHub la sigue publicando y puede confundir a los navegadores.

4. **Copia los archivos nuevos.** Abre la carpeta que descomprimiste, selecciona **todo lo que hay dentro** (Ctrl+A en Windows, Cmd+A en Mac), cópialo y pégalo dentro de la carpeta del repositorio.

   **Muy importante:** `index.html` debe quedar **directamente** en la carpeta del repositorio, no dentro de otra carpeta. Es el error más común: si al abrir la carpeta del repositorio ves primero una carpeta llamada `justo-v2` y dentro los archivos, quedó mal; mueve el contenido un nivel arriba.

   Al final, la carpeta del repositorio debe verse así:

   ```
   justo/
   ├── index.html
   ├── styles.css
   ├── app.js
   ├── config.js
   ├── sw.js
   ├── manifest.webmanifest
   ├── LEEME.md
   ├── data/
   │   ├── es.json
   │   ├── en.json
   │   └── pt.json
   └── icons/
       └── (5 imágenes)
   ```

### Parte B. Subirlos a GitHub

5. **Vuelve a GitHub Desktop.** En la columna izquierda, pestaña **Changes**, verás la lista de archivos cambiados: los nuevos con un signo **+** verde, los modificados con un punto amarillo y los borrados con un signo **−** rojo. Es lo esperado. Si no aparece ningún cambio, copiaste en otra carpeta: repite el paso 2.

   Si sale un aviso sobre **LF** y **CRLF**, es normal en Windows. Ignóralo.

6. **Escribe qué cambiaste.** Abajo a la izquierda hay una caja que dice **Summary (required)**. Escribe, por ejemplo: `Justo v2 en tres idiomas`. (No necesitas llenar *Description*.)

7. Pulsa el botón azul de abajo: **Commit to main**.
   Un *commit* es como guardar una foto de los cambios en tu computador. **Todavía no está en internet.**

8. Pulsa **Push origin** (botón arriba, en el centro o a la derecha, con una flecha hacia arriba).
   Esto sí envía los cambios a GitHub. **Sin este paso no se publica nada.** Cuando termina, el botón vuelve a decir *Fetch origin*.

9. **Comprueba en github.com:** abre https://github.com/ivanwAU/justo (recarga la página). Debes ver `index.html`, `app.js`, `data` y `icons` en la lista de archivos, y arriba el título de tu último commit. Si ves una carpeta `content` vieja, bórrala desde tu computador (paso 3) y repite los pasos 5 a 8.

### Parte C. Activar GitHub Pages (solo la primera vez)

Si ya lo activaste antes con la v1, comprueba que siga así y pasa a la Parte D.

10. En https://github.com/ivanwAU/justo pulsa la pestaña **Settings** (la del engranaje, arriba a la derecha de la lista de pestañas).
11. En el menú de la izquierda busca **Pages** (está en el grupo *Code and automation*; tal vez tengas que bajar un poco).
12. En **Build and deployment**, en **Source**, elige **Deploy from a branch**.
13. En **Branch**, elige **main** y, en el segundo menú, **/ (root)**. Pulsa **Save**.
14. **Espera de 1 a 3 minutos.** Recarga la página de *Pages*: arriba aparece el mensaje **"Your site is live at https://ivanwau.github.io/justo/"**.

   Para ver el avance, abre la pestaña **Actions**: verás una tarea llamada *pages build and deployment*. Punto amarillo = trabajando; **check verde = publicado**; X roja = falló (mira la sección 3).

### Parte D. Comprobar que quedó bien

Abre estos enlaces (si hace falta, en una ventana privada para evitar copias viejas):

- https://ivanwau.github.io/justo → debe abrir la bienvenida de Justo, con el selector **Español · English · Português** y las preguntas de visa, ciudad y dinero.
- https://ivanwau.github.io/justo/data/es.json
- https://ivanwau.github.io/justo/data/en.json
- https://ivanwau.github.io/justo/data/pt.json
  → los tres deben mostrar texto (muchas llaves y comillas). Si alguno dice **404**, esa carpeta o archivo no se subió: repite los pasos 4 a 8.

Prueba también desde tu celular:
1. Abre el enlace del sitio, cambia entre los tres idiomas y completa la bienvenida.
2. Marca una tarea, cierra el navegador y vuelve a abrir: debe recordar tu progreso.
3. Opcional: en el menú del navegador, **Agregar a pantalla de inicio**.

---

## 3. Si algo sale mal

| Qué ves | Qué hacer |
|---|---|
| **404 "There isn't a GitHub Pages site here"** al abrir el sitio | O no activaste Pages (Parte C), o todavía está publicando (espera 3 a 5 minutos), o el repositorio es privado (debe ser **Public**). |
| La página abre, pero sin diseño o en blanco | Casi siempre `index.html` quedó dentro de una subcarpeta. En github.com/ivanwAU/justo debe verse `index.html` **en la lista principal**. Si está dentro de una carpeta, muévelo a la carpeta principal del repositorio y repite los pasos 5 a 8. |
| Mensaje **"No se pudo cargar Justo"** (o *Justo could not load*, o *Não foi possível carregar o Justo*) | Abre https://ivanwau.github.io/justo/data/es.json. Si da 404, falta la carpeta `data`. Si abre pero el error sigue, quedó una coma o comilla mal puesta en algún `.json` que editaste (ver sección 7). |
| Sigues viendo la versión anterior | Recarga sin caché: **Ctrl+Shift+R** (Windows) o **Cmd+Shift+R** (Mac). En el celular, abre el sitio en una pestaña privada. Confirma en *Actions* que la última tarea terminó en verde. Si persiste, cambia `VERSION` en `sw.js` (sección 4). |
| GitHub Desktop **no muestra cambios** | Copiaste los archivos a otra carpeta. Usa siempre **Repository → Show in Explorer/Finder** para abrir la carpeta correcta. |
| El botón dice **Fetch origin** y no **Push origin** | No hay nada para subir: falta hacer el commit (paso 7). |
| Al pulsar Push sale **"rejected"** o pide hacer **Pull** | Pulsa **Fetch origin**, luego **Pull origin**, y vuelve a **Push origin**. |
| GitHub Desktop pide iniciar sesión | **File → Options → Accounts → Sign in** (Mac: **GitHub Desktop → Settings → Accounts**). |
| Se subió una carpeta `content` o `Content` vieja | Bórrala en tu computador (paso 3), haz commit y Push de nuevo. |
| Un cambio mío rompió el sitio | En GitHub Desktop, pestaña **History**, clic derecho sobre tu último commit → **Revert changes in commit**, y luego **Push origin**. |

**Plan B si GitHub Desktop no coopera** (sin instalar nada): en github.com/ivanwAU/justo pulsa **Add file → Upload files**, arrastra los archivos y las carpetas `data` e `icons` del zip, escribe un resumen abajo y pulsa **Commit changes**. Este método no borra los archivos viejos: para eliminar uno, ábrelo en github.com, pulsa los tres puntos **⋯** → **Delete file** y confirma el commit.

---

## 4. Cómo actualizar el sitio más adelante

Siempre es el mismo ciclo:

1. Edita el archivo que quieras con el Bloc de notas (o cualquier editor de texto) **dentro de la carpeta del repositorio** (no en el zip).
2. En GitHub Desktop aparecerá el cambio en **Changes**. Escribe un resumen, **Commit to main** y **Push origin**.
3. Espera 1 o 2 minutos y recarga el sitio.

**Cuándo cambiar `VERSION` en `sw.js`:** la app intenta siempre la red primero, así que casi todos los cambios aparecen solos. Si cambias texto o código y alguien sigue viendo lo anterior, abre `sw.js` y sube el número de `VERSION` (por ejemplo `justo-v2-6` → `justo-v2-7`). Todos los dispositivos descargarán los archivos nuevos en su próxima visita.

**Tu correo en GitHub (opcional, recomendado):** cada commit lleva tu nombre y un correo, y el repositorio es público. Para que no aparezca tu correo personal: en github.com → **Settings → Emails**, activa **Keep my email addresses private**; y en GitHub Desktop → **Options/Settings → Git**, elige el correo que termina en `@users.noreply.github.com`. Solo afecta a los commits futuros. (Los nombres de los menús pueden variar un poco según la versión.)

---

## 5. Los tres idiomas

- **Cómo elige el idioma:** la primera vez usa el idioma del navegador de la persona (español, inglés o portugués). Si es otro (por ejemplo, tailandés), abre en inglés. Después, la persona puede cambiarlo cuando quiera en la bienvenida, en **Mi perfil** o en el pie de la página, y Justo lo recuerda en ese dispositivo.
- **Qué cambia con el idioma:** todos los textos, los nombres de los meses, el formato de los números (1.000,5 en español y portugués; 1,000.5 en inglés) y los mensajes listos para copiar. Los enlaces oficiales son los mismos en los tres idiomas.
- **El portugués es el de Brasil** (`pt-BR`).
- **Frases y mensajes en inglés:** en español y en portugués, cada frase en inglés lleva su traducción debajo, para que la persona entienda lo que dice. En la versión en inglés no se muestra traducción.
- **Las traducciones al inglés y al portugués las hice yo (Claude).** Antes de lanzar públicamente, conviene que una persona nativa o muy cercana al idioma las lea, sobre todo el portugués de Brasil. Es normal que haya matices por pulir.
- **Para corregir una traducción:** abre `data/en.json` o `data/pt.json` y cambia solo el texto entre comillas. **No cambies** las claves (lo que está a la izquierda de los dos puntos), los `id`, ni los enlaces `https://…`. Lo mismo vale para el español.
- **Tailandés u otro idioma:** no está incluido. Agregarlo requiere un archivo `data/th.json` y un par de líneas en `app.js` y `sw.js`; se puede hacer cuando lo quieras.

---

## 6. Activar los comentarios (privados)

Los comentarios **no son públicos**: Justo no tiene ninguna sección donde se vean los mensajes de otras personas. Los recibes tú, en el formulario o correo que elijas, y decides qué ajustar. Mientras `config.js` esté vacío, no aparece ningún botón ni sección de comentarios.

**Opción recomendada: un formulario gratuito (Google Forms)**

1. Entra a https://forms.google.com con tu cuenta y crea un **formulario en blanco**.
2. Agrega unas pocas preguntas. Sugeridas: *¿Qué te sirvió?*, *¿Qué te faltó o no entendiste?*, *¿En qué ciudad llegaste? (opcional)*, *¿Quieres que te escriba? Correo (opcional)*.
3. En la pestaña **Respuestas** activa **Recibir notificaciones por correo de nuevas respuestas** (en el menú de los tres puntos). Deja **desactivadas** las opciones que muestran un resumen de las respuestas a quien responde (en **Configuración**).
4. Pulsa **Enviar**, elige el ícono de **enlace** y copia el link (empieza con `https://`).
5. Abre `config.js` y pégalo entre las comillas:

```js
window.JUSTO_CONFIG = {
  feedbackUrl: "https://AQUI-VA-EL-LINK-DE-TU-FORMULARIO",
  feedbackEmail: ""
};
```

6. Commit y **Push origin**, igual que en la Parte B.

**Qué verá la persona:** el botón "Enviar comentarios (son privados)" en el pie de la página, una tarjeta al final de la pestaña Recursos y una tarea en la fase "Mes 2+". Todos abren una ventana que explica que no se publica y avisa que no envíe pasaporte, TFN ni números de cuenta.

**Alternativa: un correo** (`feedbackEmail: "tucorreo@..."`). Ojo: como el sitio es público, el correo queda visible en el código y los robots de spam pueden encontrarlo. Si lo haces, crea una dirección aparte solo para Justo. Si pones las dos opciones, se usa el formulario.

---

## 7. Cambiar textos, enlaces o tareas

Todo vive en `data/es.json`, `data/en.json` y `data/pt.json`; no necesitas tocar `app.js`. Si cambias algo que debe verse en los tres idiomas, cámbialo en los tres archivos.

- `phases`: las fases y sus tareas (`text` es lo que se ve; `why` es la explicación al abrirla; `links` son sus enlaces).
- `work`: el cuestionario de trabajo y el plan de 7 días.
- `resources`: la pestaña Recursos → Enlaces (`kind` indica si es de gobierno o comercial).
- `glossary`, `phrases`, `templates`: glosario, frases en inglés y mensajes listos para copiar.
- `ui`: los textos de botones y mensajes de la interfaz.
- `meta.updated` y `ui["foot.updated"]`: la fecha de "Contenido revisado en…". Actualízala cuando revises.

Reglas para editar un `.json` sin romperlo: respeta las comillas `" "`, las comas entre elementos (y **ninguna** coma después del último), y los saltos de línea dentro de un texto se escriben como `\n`. Si algo se rompe, deshaz el cambio con **Revert** (ver sección 3) y vuelve a intentar con un cambio más pequeño.

---

## 8. Revisión periódica (las reglas y los links cambian)

- **Enlaces:** cada 2 o 3 meses abre algunos de la pestaña Recursos. Los sitios de gobierno a veces cambian de dirección. Los enlaces comerciales (alojamiento, bancos, envío de dinero, telefonía) son opciones, no recomendaciones, y **no los verifiqué uno por uno**: la propia app avisa que se compare y verifique antes de pagar.
- **Cifras y reglas:** a propósito, Justo enlaza a la fuente oficial en vez de repetir números que cambian (horas de trabajo con visa de estudiante, reglas de superannuation, etc.). Los límites de aduana (ABF) aparecen solo como referencia. Antes de lanzar públicamente, confirma que esos enlaces siguen apuntando a la página correcta.
- **Mejor señal de qué corregir:** los comentarios de las personas que ya llegaron.

---

## 9. Privacidad: qué guarda la app

- Solo en el dispositivo (`localStorage`, claves `justo.v2` y `justo.lang`): perfil, progreso, respuestas del cuestionario de trabajo e idioma elegido.
- Sin cuentas, sin analítica, sin fuentes ni scripts de terceros.
- **Mi perfil → Borrar todos mis datos** elimina todo lo guardado (se conserva solo el idioma elegido).
- Los datos de visa y los cuestionarios no se envían a ningún sitio. Solo el formulario de comentarios, si lo activas y la persona decide usarlo.

---

## 10. Qué no incluye esta versión (decisiones)

- Sin tailandés (todavía).
- Sin "encargos" (quedó fuera de esta versión).
- Sin cuentas ni sincronización entre dispositivos: el progreso vive en el navegador de cada persona.
