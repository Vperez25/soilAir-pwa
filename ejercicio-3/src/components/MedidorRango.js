/**
 * components/MedidorRango.js
 * -----------------------------------------------------------------------------
 * Barra que ubica una lectura del nodo dentro de su rango.
 *
 * La barra completa es el rango CRÍTICO, la franja verde es el rango IDEAL y la
 * marca vertical es el valor medido. Es la misma lectura visual que usan las
 * SensorCard de la app móvil, pero mostrando también dónde está el límite.
 */

import { claseEstado } from '../utils/slugify.js';

const ETIQUETAS = {
  optimo: 'Óptimo',
  bajo: 'Bajo',
  alto: 'Alto',
  'critico-bajo': 'Crítico bajo',
  'critico-alto': 'Crítico alto',
};

/** Posición porcentual de un valor dentro del rango crítico (0–100). */
function porcentaje(valor, [min, max]) {
  if (max === min) return 0;
  const p = ((valor - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, p));
}

/** Formatea el número sin decimales inútiles: 6.0 -> "6", 6.4 -> "6.4". */
function num(valor) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

export function MedidorRango(metrica) {
  const { etiqueta, unidad, valor, ideal, critico, estado } = metrica;

  const inicioIdeal = porcentaje(ideal[0], critico);
  const finIdeal = porcentaje(ideal[1], critico);
  const posicion = porcentaje(valor, critico);

  return `
    <li class="metrica ${claseEstado(estado)}">
      <div class="metrica__encabezado">
        <span class="metrica__etiqueta">${etiqueta}</span>
        <span class="metrica__valor">${num(valor)}<small>${unidad}</small></span>
      </div>

      <div class="metrica__barra" role="img"
           aria-label="${etiqueta}: ${num(valor)}${unidad}, ideal entre ${num(ideal[0])} y ${num(ideal[1])}${unidad}. Estado: ${ETIQUETAS[estado]}.">
        <span class="metrica__ideal" style="left:${inicioIdeal}%; width:${finIdeal - inicioIdeal}%"></span>
        <span class="metrica__marca" style="left:${posicion}%"></span>
      </div>

      <div class="metrica__pie">
        <span class="metrica__estado">${ETIQUETAS[estado]}</span>
        <span class="metrica__rango">ideal ${num(ideal[0])}–${num(ideal[1])}${unidad}</span>
      </div>
    </li>
  `;
}
