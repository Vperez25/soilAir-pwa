/**
 * services/temaService.js
 * -----------------------------------------------------------------------------
 * Tema visual de la app (claro / oscuro).  ->  localStorage
 *
 * POR QUÉ localStorage Y NO OTRA COSA
 * El tema es una preferencia del usuario, no un dato del flujo de trabajo:
 *   - debe sobrevivir a cerrar el navegador  -> descarta sessionStorage;
 *   - solo lo consume el propio JavaScript del cliente, nunca hace falta
 *     mandarlo al servidor -> una cookie solo agregaría peso a cada petición;
 *   - debe ser el mismo en todas las pestañas del sitio -> localStorage es el
 *     único de los tres que además avisa del cambio con el evento `storage`.
 *
 * El tema no se aplica con clases sino con el atributo `data-tema` en <html>:
 * así las hojas de estilo solo redefinen las variables de main.css y ninguna
 * regla de color se duplica.
 *
 * El valor se guarda en TEXTO PLANO ("claro" / "oscuro") a propósito: el
 * pequeño script de arranque de index.html lo lee antes de que baje un solo
 * módulo, para que la página no parpadee en claro.
 */

import { LOCAL, CLAVES, leer, guardar, borrar } from '../utils/almacenamiento.js';

export const TEMA_CLARO = 'claro';
export const TEMA_OSCURO = 'oscuro';

const VALIDOS = [TEMA_CLARO, TEMA_OSCURO];

/** Funciones que quieren enterarse cuando el tema cambia (el botón del shell). */
const suscriptores = new Set();

/**
 * Tema que pide el sistema operativo. Es el valor inicial cuando el usuario
 * todavía no ha elegido nada.
 *
 * @returns {'claro'|'oscuro'}
 */
export function temaDelSistema() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? TEMA_OSCURO : TEMA_CLARO;
}

/**
 * Tema elegido por el usuario, o null si nunca eligió (o si localStorage está
 * bloqueado). Se valida el contenido porque la clave la pudo tocar cualquiera
 * desde DevTools.
 *
 * @returns {'claro'|'oscuro'|null}
 */
export function temaGuardado() {
  const valor = leer(LOCAL, CLAVES.tema);
  return VALIDOS.includes(valor) ? valor : null;
}

/** Tema que se está mostrando ahora mismo. */
export function temaActual() {
  const puesto = document.documentElement.dataset.tema;
  return VALIDOS.includes(puesto) ? puesto : temaDelSistema();
}

/**
 * Pinta un tema y (opcionalmente) lo recuerda.
 *
 * @param {'claro'|'oscuro'} tema
 * @param {{persistir?: boolean}} [opciones] persistir=false cuando el cambio
 *        viene de OTRA pestaña: ahí el valor ya está en localStorage y volver a
 *        escribirlo solo dispararía más eventos.
 * @returns {'claro'|'oscuro'} el tema que quedó aplicado
 */
export function aplicarTema(tema, { persistir = true } = {}) {
  const elegido = VALIDOS.includes(tema) ? tema : temaDelSistema();

  document.documentElement.dataset.tema = elegido;

  // Si localStorage falla, guardar() ya avisó al usuario y devolvió false.
  // La app no hace nada más: el tema queda aplicado hasta recargar.
  if (persistir) guardar(LOCAL, CLAVES.tema, elegido);

  suscriptores.forEach((avisar) => avisar(elegido));

  return elegido;
}

/** Cambia al tema contrario al que se ve. */
export function alternarTema() {
  return aplicarTema(temaActual() === TEMA_OSCURO ? TEMA_CLARO : TEMA_OSCURO);
}

/** Olvida la preferencia y vuelve a lo que diga el sistema. Lo usa /diagnostico. */
export function olvidarTema() {
  borrar(LOCAL, CLAVES.tema);
  return aplicarTema(temaDelSistema(), { persistir: false });
}

/**
 * Registra un oyente para los cambios de tema.
 *
 * @param {(tema: string) => void} fn
 * @returns {() => void} función para darse de baja
 */
export function alCambiarTema(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

/**
 * Arranca el servicio. Se llama una sola vez, desde main.js.
 *
 * Aquí está la parte de "compartirse entre pestañas": el evento `storage` se
 * dispara en las OTRAS pestañas del mismo origen cuando una escribe en
 * localStorage. Una pestaña abierta después no lo necesita, porque al cargar
 * lee el valor guardado; este listener es para las que ya estaban abiertas.
 */
export function iniciarTema() {
  aplicarTema(temaGuardado() ?? temaDelSistema(), { persistir: false });

  window.addEventListener('storage', (evento) => {
    if (evento.key !== CLAVES.tema) return;

    // newValue viene en null cuando la otra pestaña BORRÓ la clave
    // (el botón "Limpiar" de la vista de diagnóstico).
    aplicarTema(evento.newValue ?? temaDelSistema(), { persistir: false });
  });

  // Mientras el usuario no haya elegido, la app sigue al sistema en vivo.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!temaGuardado()) aplicarTema(temaDelSistema(), { persistir: false });
  });
}
