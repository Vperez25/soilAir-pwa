/**
 * components/SelectorTema.js
 * -----------------------------------------------------------------------------
 * Botón claro/oscuro del App Shell.
 *
 * Mismo reparto que Navbar.js: el MARCADO vive en index.html porque forma parte
 * del shell y tiene que pintarse antes de que corra un módulo; aquí solo está
 * la lógica que ese marcado necesita.
 *
 * El botón no guarda estado propio: se suscribe a temaService y se repinta
 * cuando el tema cambia, venga el cambio de un clic aquí, del sistema operativo
 * o de OTRA pestaña.
 */

import { alternarTema, temaActual, alCambiarTema, TEMA_OSCURO } from '../services/temaService.js';

/** Cómo se ve el botón en cada tema. */
const ASPECTO = {
  claro: { icono: '☀', texto: 'Claro', accion: 'Cambiar a tema oscuro' },
  oscuro: { icono: '☾', texto: 'Oscuro', accion: 'Cambiar a tema claro' },
};

/**
 * Refleja en el botón el tema que se está mostrando.
 *
 * El texto visible dice el tema ACTUAL y el aria-label dice lo que va a pasar
 * al pulsarlo: quien ve la pantalla se guía por el icono, y quien usa lector de
 * pantalla necesita saber la consecuencia, no el estado.
 *
 * @param {HTMLElement} boton
 * @param {'claro'|'oscuro'} tema
 */
function pintar(boton, tema) {
  const { icono, texto, accion } = ASPECTO[tema] ?? ASPECTO.claro;

  boton.querySelector('.tema__icono').textContent = icono;
  boton.querySelector('.tema__texto').textContent = texto;
  boton.setAttribute('aria-label', accion);
  boton.setAttribute('title', accion);
  // Para el CSS y para las pruebas manuales desde la consola.
  boton.dataset.tema = tema;
}

/** Engancha el botón del encabezado. Se llama una sola vez, desde main.js. */
export function montarSelectorTema() {
  const boton = document.querySelector('#selector-tema');
  if (!boton) return;

  boton.addEventListener('click', () => alternarTema());

  alCambiarTema((tema) => pintar(boton, tema));
  pintar(boton, temaActual());
}

export { TEMA_OSCURO };
