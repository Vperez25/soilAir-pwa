/**
 * services/filtroService.js
 * -----------------------------------------------------------------------------
 * Filtro de la vista /clima.  ->  sessionStorage
 *
 * POR QUÉ sessionStorage Y NO OTRA COSA
 * "Ver solo las parcelas de Irapuato" no es una preferencia del usuario: es el
 * estado de una consulta que está haciendo AHORA. Se pide:
 *
 *   - que aguante un F5. La vista de clima vuelve a pedir los datos a
 *     Open-Meteo en cada carga y la petición puede fallar; si el filtro se
 *     perdiera al recargar, el usuario tendría que volver a escribirlo cada vez
 *     que reintenta. Eso descarta una variable en memoria.
 *
 *   - que NO aguante cerrar la pestaña. Encontrarse la lista recortada tres
 *     días después, sin acordarse de por qué faltan parcelas, se lee como un
 *     error de la app. Eso descarta localStorage.
 *
 *   - que sea independiente por pestaña. Comparar dos regiones en dos pestañas
 *     es un caso normal, y con localStorage una pestaña le cambiaría el filtro
 *     a la otra. Eso vuelve a descartar localStorage, y una cookie todavía más:
 *     se comparte entre pestañas Y se manda al servidor en cada petición.
 *
 * sessionStorage es el único de los tres que cumple las tres condiciones: vive
 * mientras viva la pestaña.
 */

import { SESION, CLAVES, leer, guardar, borrar, disponible } from '../utils/almacenamiento.js';
import { slugify } from '../utils/slugify.js';

/** Texto del filtro guardado en esta pestaña; cadena vacía si no hay nada. */
export function filtroGuardado() {
  return leer(SESION, CLAVES.filtroClima, '') ?? '';
}

/**
 * Recuerda el filtro. Si sessionStorage está bloqueado devuelve false y la
 * vista sigue filtrando igual: lo único que se pierde es sobrevivir al F5.
 *
 * @param {string} texto
 * @returns {boolean}
 */
export function guardarFiltro(texto) {
  // Un filtro vacío no es un filtro: se borra la clave en vez de dejarla en "".
  if (!texto.trim()) return borrarFiltro();
  return guardar(SESION, CLAVES.filtroClima, texto);
}

/** Olvida el filtro de esta pestaña. Lo usa /diagnostico y el campo vacío. */
export function borrarFiltro() {
  return borrar(SESION, CLAVES.filtroClima);
}

/** ¿Está disponible sessionStorage? Reexportado para la vista de diagnóstico. */
export function filtroPersistible() {
  return disponible(SESION);
}

/**
 * Aplica el filtro sobre las lecturas.
 *
 * Se compara con slugify() en los dos lados para que la búsqueda ignore
 * acentos y mayúsculas: escribir "maiz" tiene que encontrar "Maíz".
 *
 * @param {Array<Object>} lecturas lo que devolvió climaService
 * @param {string} texto
 * @returns {Array<Object>} las lecturas que coinciden
 */
export function filtrar(lecturas, texto) {
  const buscado = slugify(texto);
  if (!buscado) return lecturas;

  return lecturas.filter((lectura) => {
    const campos = [lectura.parcela, lectura.region, lectura.cultivo, lectura.nodo];
    return slugify(campos.join(' ')).includes(buscado);
  });
}
