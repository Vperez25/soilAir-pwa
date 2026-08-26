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
