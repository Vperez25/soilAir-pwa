/**
 * utils/escapar.js
 * -----------------------------------------------------------------------------
 * Escapado de texto para las plantillas.
 *
 * Las vistas de este proyecto arman HTML con template literals, así que
 * cualquier texto que NO venga de nuestros propios módulos tiene que pasar por
 * aquí antes de interpolarse.
 *
 * Desde que hay persistencia esto dejó de ser teórico: el filtro de /clima lo
 * escribe el usuario y se relee de sessionStorage, y una cookie se puede editar
 * a mano desde DevTools. Si ese texto se pegara tal cual dentro de un
 * `value="..."` o de un párrafo, bastaría con guardar
 * `"><img src=x onerror=alert(1)>` para inyectar marcado.
 */

/** Sustituciones mínimas para texto que va DENTRO de un elemento o atributo. */
const REEMPLAZOS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Convierte los caracteres con significado en HTML a sus entidades.
 *
 *   escaparHtml('<b>hola"')  ->  '&lt;b&gt;hola&quot;'
 *
 * El "&" va primero en el objeto por claridad, pero el replace recorre el
 * texto una sola vez, así que no hay riesgo de doble escapado.
 *
 * @param {unknown} texto
 * @returns {string}
 */
export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (caracter) => REEMPLAZOS[caracter]);
}
