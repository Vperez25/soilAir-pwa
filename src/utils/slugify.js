/**
 * utils/slugify.js
 * -----------------------------------------------------------------------------
 * Exportaciones NOMBRADAS reutilizadas en varios archivos:
 *   - slugify()  -> components/CultivoCard.js  y  services/cultivosService.js
 *   - claseEstado() -> components/MedidorRango.js y views/CultivoDetailView.js
 */

/**
 * Convierte un texto en un identificador apto para URL.
 *   "Chile Manzano" -> "chile-manzano"
 *   "Maíz"          -> "maiz"
 *
 * @param {string} texto
 * @returns {string}
 */
export function slugify(texto) {
  return String(texto)
    .normalize('NFD')                  // separa la letra de su acento
    .replace(/[\u0300-\u036f]/g, '')   // borra los acentos sueltos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')       // todo lo que no sea letra/número -> "-"
    .replace(/^-+|-+$/g, '');          // sin guiones al inicio ni al final
}

/**
 * Traduce el estado de una lectura a una clase CSS.
 * Mismos estados que usa la app móvil de SoilAir en SensorCard.
 *
 * @param {'optimo'|'bajo'|'alto'|'critico-bajo'|'critico-alto'} estado
 * @returns {string}
 */
export function claseEstado(estado) {
  return `estado--${slugify(estado)}`;
}
