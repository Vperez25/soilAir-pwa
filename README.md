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
