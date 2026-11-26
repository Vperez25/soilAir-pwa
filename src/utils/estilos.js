/**
 * utils/estilos.js
 * -----------------------------------------------------------------------------
 * Hojas de estilo BAJO DEMANDA.
 *
 * index.html solo enlaza el CSS que necesita cualquier pantalla (variables,
 * encabezado, pie, portada). El de cada vista (bitácora, clima, diagnóstico…)
 * lo pide el router con cargarEstilos() la primera vez que se entra a esa ruta,
 * y espera a que termine de cargar ANTES de pintar la vista: así no se ve la
 * vista sin estilos ni un salto cuando llegan.
 *
 * Cada hoja se pide una sola vez por documento. Las rutas son relativas al
 * <base> de index.html, igual que los <link> del HTML.
 */

/** href -> promesa de carga. */
const pedidas = new Map();

function cargarHoja(href) {
  if (pedidas.has(href)) return pedidas.get(href);

  const promesa = new Promise((resolver, rechazar) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolver();
    link.onerror = () => {
      link.remove();
      pedidas.delete(href); // que el siguiente intento vuelva a pedirla
      rechazar(new Error(`no se pudo cargar ${href}`));
    };
    document.head.append(link);
  });

  pedidas.set(href, promesa);
  return promesa;
}

/**
 * Carga (o reutiliza) varias hojas de estilo, en el orden dado.
 *
 * @param {string[]} [hojas] p. ej. ['styles/bitacora.css']
 * @returns {Promise<void>} se cumple cuando todas están aplicadas
 */
export function cargarEstilos(hojas = []) {
  return Promise.all(hojas.map(cargarHoja)).then(() => undefined);
}
