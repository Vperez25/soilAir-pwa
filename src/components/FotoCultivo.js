/**
 * components/FotoCultivo.js
 * -----------------------------------------------------------------------------
 * Foto de un cultivo, optimizada. Devuelve un <picture> con:
 *
 *   - FORMATOS MODERNOS: <source> AVIF y WebP; el navegador toma el primero que
 *     entienda. El <img> con JPEG queda como último respaldo.
 *   - IMÁGENES RESPONSIVAS: srcset con 480/720/1200 px + `sizes` (el ancho que
 *     la foto ocupará en pantalla). Con eso el navegador baja SOLO la variante
 *     que necesita: un celular no descarga la de 1200 px.
 *   - width/height: el navegador reserva el hueco 3:2 antes de que llegue la
 *     foto, así el contenido no "salta" (CLS = 0).
 *   - CARGA DIFERIDA: loading="lazy" para las que no se ven al abrir; el
 *     navegador las pide cuando el usuario se acerca a ellas con el scroll.
 *   - PRIORIDAD: la foto principal (la primera tarjeta o la de la ficha) va con
 *     loading="eager" y fetchpriority="high", porque suele ser el elemento más
 *     grande de la pantalla (LCP) y no debe esperar.
 *   - decoding="async": decodificar la imagen no bloquea el hilo principal.
 *
 * Las rutas son relativas al <base> de index.html, así que funcionan bajo
 * /soilAir-pwa/ en GitHub Pages y bajo / en local.
 */

import { ALTO_BASE, ANCHO_BASE, ANCHOS, FOTOS } from '../services/fotosCultivos.js';
import { escaparHtml } from '../utils/escapar.js';

const ruta = (id, ancho, formato) => `images/cultivos/${id}-${ancho}.${formato}`;
const srcset = (id, formato) => ANCHOS.map((ancho) => `${ruta(id, ancho, formato)} ${ancho}w`).join(', ');

/**
 * @param {string} id slug del cultivo ("chile-manzano")
 * @param {{sizes: string, prioridad?: boolean, clase?: string}} opciones
 *        sizes: ancho que ocupará en pantalla en cada caso (media queries)
 *        prioridad: true para la foto principal visible al abrir
 * @returns {string} HTML del <picture>, o '' si el cultivo no tiene foto
 */
export function FotoCultivo(id, { sizes, prioridad = false, clase = '' }) {
  const foto = FOTOS[id];
  if (!foto) return '';

  const carga = prioridad ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

  return `
    <picture class="${escaparHtml(clase)}">
      <source type="image/avif" srcset="${srcset(id, 'avif')}" sizes="${sizes}" />
      <source type="image/webp" srcset="${srcset(id, 'webp')}" sizes="${sizes}" />
      <img
        src="${ruta(id, 720, 'jpg')}"
        alt="${escaparHtml(foto.alt)}"
        width="${ANCHO_BASE}"
        height="${ALTO_BASE}"
        ${carga}
        decoding="async"
      />
    </picture>
  `;
}
