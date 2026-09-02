README.md
@@ -1,35 +1,8 @@

# SoilAir · PWA

# SoilAir · Mini SPA (Unidad 1, Ejercicio 3)

Repositorio de la materia **PWA**. Aquí vive la versión web de **SoilAir**, un
sistema de monitoreo de suelo y aire para agricultura de precisión: en campo se
instalan nodos con sensores de temperatura, pH, humedad, conductividad eléctrica
y NPK, y la interfaz compara cada lectura contra los rangos ideal y crítico del
cultivo.
Versión web del catálogo de cultivos de **SoilAir**, el proyecto móvil de monitoreo
de suelo y aire. Muestra los cultivos que la red de nodos vigila y, en cada ficha,
la última lectura del nodo comparada contra los rangos ideal y crítico del cultivo.

Cada ejercicio de la materia es una carpeta independiente, con su propio
`index.html` y su propio README. No hay build ni dependencias: HTML, CSS y
módulos ES6 nativos.
Sin frameworks: módulos ES6, ruteo propio sobre la History API.

## Cómo ejecutar cualquier ejercicio

Los módulos ES6 no funcionan con `file://`; hace falta un servidor HTTP:

- **VS Code** → extensión _Live Server_ → clic derecho en el `index.html` del
  ejercicio → _Open with Live Server_.
- **Python** → dentro de la carpeta del ejercicio:

  ```bash
  python3 -m http.server 8000
  ```

## Unidad 1, Ejercicio 5 · Consumo de una API REST con fetch

Se agregó la vista **`/clima` — Condiciones en campo**, que genera su contenido a
partir de datos reales de [Open-Meteo](https://open-meteo.com) (gratuita, sin API
key ni OAuth, responde JSON). Se eligió esa API porque devuelve variables de aire
**y de suelo**, que es justo lo que mide un nodo SoilAir.

### Archivos

| Archivo | Papel |
| --- | --- |
| `src/services/apiService.js` | Cliente HTTP genérico (patrón `ApiService`). Único punto del proyecto que llama a `fetch`: arma la URL, aplica un timeout con `AbortController`, revisa `response.ok` y lanza `ApiError` con un mensaje legible. |
| `src/services/climaService.js` | Hereda de `ApiService`. Pide las condiciones de las 6 parcelas en **una sola** petición, normaliza el JSON y calcula la recomendación de riego. No toca el DOM. |
| `src/views/ClimaView.js` | La vista. No llama a `fetch`: solo decide qué HTML corresponde a cada estado de la petición. |
| `styles/climaView.css` | Estilos de la vista, Mobile First. |

### Los tres estados de la petición

1. **Cargando** — `ClimaView()` devuelve de inmediato seis tarjetas *skeleton*,
   una por parcela conocida, con animación de latido.
2. **Éxito** — `ClimaView.montar()` hace `await climaService.obtenerCondiciones()`
   y sustituye el skeleton por las tarjetas reales (`.map()`), con aire, humedad,
   radiación, temperatura y humedad del suelo, máximas/mínimas y lluvia.
3. **Error** — `try/catch` alrededor de la llamada; se pinta un aviso con
   `role="alert"`, el motivo real del fallo y un botón **Reintentar**.

Todo el flujo usa `async/await`; no hay ningún `.then()` encadenado.

### Cambio en el router

`Router.render()` ganó un gancho **opcional**: si la vista expone una función
`montar()`, el router la ejecuta *después* de insertar el HTML, pasándole el
contenedor y un `vigente()` que indica si el usuario sigue en esa ruta (evita que
una respuesta tardía escriba sobre otra pantalla). Las vistas que no definen
`montar()` se comportan exactamente igual que antes.

## Publicación en GitHub Pages

Pages no publica el proyecto en la raíz del dominio, sino dentro de una carpeta
con el nombre del repositorio:

```
https://vperez25.github.io/soilAir-pwa/
                           └────┬────┘
                          eso es el BASE_PATH
```

Si el router lo ignora, la primera pantalla carga bien pero al cambiar de
sección la ruta interna sale mal y todo cae en el 404.

### `src/config.js`

El nombre del repositorio se escribe **una sola vez**, ahí. De él salen:

- `BASE_PATH` — el prefijo (`'/soilAir-pwa'` publicado, `''` en local). Se
  detecta mirando el primer segmento de la URL, así el mismo código sirve en los
  dos entornos sin tocar nada.
- `quitarBase(pathname)` — hace el `replace` del prefijo, solo si está al inicio.

### Quién usa qué

| Archivo | Qué hace con el BASE_PATH |
| --- | --- |
| `src/router/router.js` | `rutaCompleta()` (**fullPath**) se lo **pone** a una ruta interna; `rutaActual()` (**path**) se lo **quita** a `location.pathname`. Ambos nombres se exportan también como `fullPath` y `path`. |
| `src/components/Navbar.js` | `linkPath()` arma el href real; `montarNavbar()` reescribe los `href` del encabezado al arrancar; `marcarActivo()` compara quitándole el prefijo al href. |
| `index.html` / `404.html` | Un `<base>` que se fija al arrancar, para que las hojas de estilo y el módulo se resuelvan igual desde cualquier profundidad de ruta. |

El marcado del navbar sigue en `index.html` (es parte del App Shell y debe
pintarse antes que cualquier módulo); `Navbar.js` aporta solo la lógica.

### `404.html`

Es una **copia de `index.html`**. GitHub Pages lo devuelve cuando la URL no
corresponde a un archivo real del repositorio, que es exactamente el caso de las
rutas de la SPA (`/clima`, `/cultivo/maiz`). Al cargar el mismo App Shell y el
mismo router, la ruta se resuelve del lado del cliente: si existe se pinta su
vista, y si no, el router monta `NotFoundView` y se ve la pantalla de código 404.

> Si editas `index.html`, copia el cambio a `404.html`.

Detalle conocido: en un enlace directo *en frío* a una ruta de dos segmentos
(`/soilAir-pwa/cultivo/maiz`), el precargador del navegador pide las hojas de
estilo con la ruta vieja antes de que se fije el `<base>`, las vuelve a pedir
bien y la página carga correcta. Son unas pocas peticiones desperdiciadas, sin
efecto visible.
