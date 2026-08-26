# SoilAir · PWA

Repositorio de la materia **PWA**. Aquí vive la versión web de **SoilAir**, un
sistema de monitoreo de suelo y aire para agricultura de precisión: en campo se
instalan nodos con sensores de temperatura, pH, humedad, conductividad eléctrica
y NPK, y la interfaz compara cada lectura contra los rangos ideal y crítico del
cultivo.

Cada ejercicio de la materia es una carpeta independiente, con su propio
`index.html` y su propio README. No hay build ni dependencias: HTML, CSS y
módulos ES6 nativos.

## Cómo ejecutar cualquier ejercicio

Los módulos ES6 no funcionan con `file://`; hace falta un servidor HTTP:

- **VS Code** → extensión *Live Server* → clic derecho en el `index.html` del
  ejercicio → *Open with Live Server*.
- **Python** → dentro de la carpeta del ejercicio:

  ```bash
  python3 -m http.server 8000
  ```

  y abrir <http://localhost:8000>.

> En las SPA con History API, escribir a mano una URL profunda (por ejemplo
> `/cultivo/maiz`) y recargar devuelve el 404 del servidor: un servidor estático
> no reescribe esas rutas hacia `index.html`. La navegación dentro de la app
> —enlaces, Atrás y Adelante— sí funciona.

### Autores

Vincent Perez Adriano 
Alejandro Silvestre Amador 