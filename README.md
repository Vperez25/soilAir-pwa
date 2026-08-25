# SoilAir · Mini SPA (Unidad 1, Ejercicio 3)

Versión web del catálogo de cultivos de **SoilAir**, el proyecto móvil de monitoreo
de suelo y aire. Muestra los cultivos que la red de nodos vigila y, en cada ficha,
la última lectura del nodo comparada contra los rangos ideal y crítico del cultivo.

Sin frameworks: módulos ES6, ruteo propio sobre la History API.

## Cómo ejecutarlo

Los módulos ES6 necesitan servidor HTTP (no `file://`):

- VS Code → extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.
- O bien: `python3 -m http.server 8000` dentro de esta carpeta y abrir `http://localhost:8000`.

> Nota: escribir a mano una URL profunda como `/cultivo/maiz` y recargar da 404 del
> servidor, porque Live Server no reescribe rutas hacia `index.html`. La navegación
> dentro de la app (enlaces, Atrás y Adelante) sí funciona; es el comportamiento
> normal de una SPA con History API servida por un servidor estático.

## Rutas

| Ruta | Vista | Tipo |
|---|---|---|
| `/` | `HomeView` | estática, listado |
| `/acerca` | `AboutView` | estática secundaria |
| `/cultivo/:id` | `CultivoDetailView` | dinámica con parámetro |
| cualquier otra | `NotFoundView` | 404 |

Ejemplos de `:id`: `jitomate`, `maiz`, `lechuga`, `fresa`, `chile-manzano`, `trigo`.

## Dónde se cumple cada requisito

| # | Requisito | Archivo |
|---|---|---|
| 1 | Estructura `router/ views/ components/ services/ utils/` | `src/` |
| 2 | Ruta estática de listado `/` | `src/views/HomeView.js` |
| 3 | Ruta estática secundaria `/acerca` | `src/views/AboutView.js` |
| 4 | Ruta dinámica con parámetro `/cultivo/:id` | `src/router/router.js` → `matchRoute()` |
| 5 | Exportación nombrada reutilizada | `slugify()` de `utils/slugify.js`, usada en `components/CultivoCard.js` y `services/cultivosService.js` |
| 6 | Exportación por defecto | `services/cultivosService.js` |
| 7 | Import dinámico dentro de una vista | `views/CultivoDetailView.js` → `await import('../services/cultivosService.js')` |
| 8 | Manejo de 404 | `views/NotFoundView.js` (ruta inexistente y también `:id` inexistente) |
| 9 | Atrás / Adelante del navegador | `popstate` en `router/router.js` |

## Sobre los dos archivos en `services/`

- `cultivosIndex.js` — índice ligero: nombre, especie, familia, ciclo y resumen.
  Es lo único que necesita el listado.
- `cultivosService.js` — **exportación por defecto**: ficha técnica completa
  (rangos ideal y crítico de ambiente y suelo), última lectura del nodo y la
  lógica que clasifica cada medición.

Están separados a propósito: así el listado se pinta sin bajar la ficha técnica y
en la pestaña **Network** se ve que `cultivosService.js` se descarga justo al
entrar al primer detalle. Los datos no se duplican: el servicio importa el índice
y le agrega la información extendida.

## Evidencia del import dinámico (entregable 2)

1. Abrir la app en `/` con las DevTools en **Network**, filtro **JS**.
2. Recargar: aparecen `main.js`, `router.js`, las vistas, `cultivosIndex.js`,
   `CultivoCard.js`, `MedidorRango.js` y `slugify.js`. **No** aparece `cultivosService.js`.
3. Clic en *Ver ficha y última lectura* de cualquier cultivo: en ese momento entra
   `cultivosService.js` a la lista. Esa es la captura.
4. Al abrir un segundo cultivo ya no se vuelve a descargar: el módulo queda en caché.

## Cómo `matchRoute` extrae el `:id` (entregable 3)

`matchRoute(patron, ruta)` recibe el patrón declarado en la tabla de rutas
(`/cultivo/:id`) y la ruta real de la URL (`/cultivo/maiz`). Parte ambas cadenas por
`/` y descarta los segmentos vacíos, con lo que quedan dos arreglos: `["cultivo",
":id"]` y `["cultivo", "maiz"]`. Si tienen distinta longitud, la ruta no coincide y
devuelve `null`. Si coinciden en longitud, recorre los segmentos en paralelo: cuando
el segmento del patrón empieza con `:`, es un parámetro, así que guarda el segmento
de la URL en un objeto usando como llave el nombre sin los dos puntos
(`params.id = "maiz"`, pasándolo antes por `decodeURIComponent`); cuando no empieza
con `:`, es un segmento fijo y tiene que ser idéntico, si no devuelve `null`. Al
terminar el recorrido devuelve el objeto de parámetros, que el router le pasa a la
vista. Por eso `CultivoDetailView` recibe `{ params: { id: "maiz" } }` y con ese id
le pide la ficha al servicio.
