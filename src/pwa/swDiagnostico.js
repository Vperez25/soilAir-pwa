/**
 * pwa/swDiagnostico.js
 * -----------------------------------------------------------------------------
 * Lectura del estado del Service Worker y verificador de scope.
 *
 * Aquí no hay HTML: solo se consulta al navegador y se devuelven objetos. La
 * vista (views/ServiceWorkerView.js) se encarga de pintarlos.
 */

import { BASE_PATH } from '../config.js';
import { SW_SCOPE, soportaSW, urlAbsoluta } from './registerSW.js';

/* ── Estado ───────────────────────────────────────────────────────────────── */

/**
 * Resume un registro en datos simples.
 *
 * Un registro puede tener hasta tres workers a la vez: `installing` (el que se
 * está instalando), `waiting` (instalado, esperando su turno) y `active` (el que
 * ya está funcionando). Cada uno tiene su propio `state`.
 *
 * @param {ServiceWorkerRegistration} registro
 */
function describir(registro) {
  const worker = registro.active ?? registro.waiting ?? registro.installing;

  return {
    scope: registro.scope,
    script: worker?.scriptURL ?? null,
    instalando: registro.installing?.state ?? null,
    enEspera: registro.waiting?.state ?? null,
    activo: registro.active?.state ?? null,
    registro,
  };
}

/**
 * Lee todo lo que la vista necesita en una sola pasada.
 *
 * Nunca lanza: si el navegador rechaza alguna consulta, el motivo queda en
 * `error` y el resto de los datos sigue siendo válido.
 *
 * @returns {Promise<{
 *   soporta: boolean, seguro: boolean, origen: string,
 *   app: ReturnType<typeof describir>|null,
 *   registros: Array<ReturnType<typeof describir>>,
 *   controlador: {script: string, estado: string}|null,
 *   error: string|null
 * }>}
 */
export async function leerEstado() {
  const estado = {
    soporta: soportaSW(),
    // localhost cuenta como contexto seguro aunque no sea HTTPS.
    seguro: window.isSecureContext,
    origen: location.origin,
    app: null,
    registros: [],
    controlador: null,
    error: null,
  };

  if (!estado.soporta) return estado;

  try {
    // getRegistration(url) devuelve el registro cuyo scope CUBRE esa URL. Se le
    // pasa el scope de la app y, por si hubiera otro registro más ancho del
    // mismo dominio, se confirma que el scope sea exactamente el nuestro.
    const registro = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (registro && registro.scope === urlAbsoluta(SW_SCOPE)) estado.app = describir(registro);

    const todos = await navigator.serviceWorker.getRegistrations();
    estado.registros = todos.map(describir);
  } catch (error) {
    estado.error = `${error.name}: ${error.message}`;
  }

  // controller es null en la PRIMERA carga después de registrar: el worker aún
  // no existía cuando esta página se pidió, y nada lo obliga a tomar control.
  const controlador = navigator.serviceWorker.controller;
  if (controlador) {
    estado.controlador = { script: controlador.scriptURL, estado: controlador.state };
  }

  return estado;
}

/* ── Verificador de scope ─────────────────────────────────────────────────── */

/**
 * ¿Queda `url` dentro de `scope`?
 *
 * Es exactamente la regla del navegador: se resuelve la URL a su forma absoluta
 * (ahí se normalizan "..", la raíz sin diagonal, etc.) y se compara por PREFIJO
 * contra el scope. Por eso un scope debe terminar en "/".
 *
 * @param {string} url   absoluta o relativa
 * @param {string} scope absoluto, como el de registration.scope
 * @returns {boolean}
 */
export function dentroDelScope(url, scope) {
  return urlAbsoluta(url).startsWith(scope);
}

/**
 * Entre varios registros, el que controla una URL: el de scope MÁS LARGO que sea
 * prefijo de ella (el más específico).
 *
 * @param {string} url
 * @param {Array<{scope: string}>} registros
 * @returns {string|null} scope del registro ganador, o null si ninguno la cubre
 */
export function registroGanador(url, registros) {
  const absoluta = urlAbsoluta(url);

  const candidatos = registros
    .filter((r) => absoluta.startsWith(r.scope))
    .sort((a, b) => b.scope.length - a.scope.length);

  return candidatos[0]?.scope ?? null;
}

/**
 * Rutas que se prueban contra el scope. Todas salen de SW_SCOPE / BASE_PATH, así
 * que la tabla sigue siendo correcta en la raíz del dominio y en /soilAir-pwa/.
 *
 * Los dos últimos casos son los que cambian según dónde esté desplegada la app:
 * con la app en la raíz, el scope "/" cubre TODO el dominio.
 *
 * @type {Array<{etiqueta: string, url: string, nota: string}>}
 */
function rutasDePrueba() {
  return [
    {
      etiqueta: 'Raíz de la app',
      url: SW_SCOPE,
      nota: 'Es el propio scope.',
    },
    {
      etiqueta: 'Ruta del router',
      url: `${SW_SCOPE}clima`,
      nota: 'Una vista de la SPA: para el navegador es una URL más bajo el scope.',
    },
    {
      etiqueta: 'Ruta dinámica del router',
      url: `${SW_SCOPE}cultivo/maiz`,
      nota: 'Es la que cubre el registro estrecho del reto.',
    },
    {
      etiqueta: 'Archivo interno',
      url: `${SW_SCOPE}src/main.js`,
      nota: 'Los archivos del proyecto también están bajo el scope.',
    },
    {
      etiqueta: 'Raíz sin diagonal final',
      url: `${location.origin}${BASE_PATH}`,
      nota: 'El scope termina en «/»: sin ella solo cae dentro si el navegador la normaliza a la raíz del dominio.',
    },
    {
      etiqueta: 'Otro proyecto del mismo dominio',
      url: `${location.origin}/otro-proyecto/`,
      nota: 'Con la app en un sub-path queda fuera; con la app en la raíz, el scope «/» lo cubre.',
    },
    {
      etiqueta: 'Otro dominio',
      url: 'https://example.com/',
      nota: 'Un Service Worker nunca controla otro origen.',
    },
  ];
}

/**
 * Tabla del verificador: cada ruta con su resultado.
 *
 * @param {string} scope     scope contra el que se compara (absoluto)
 * @param {Array<{scope: string}>} [registros] todos los registros, para saber
 *        cuál gana cuando hay más de uno
 * @returns {Array<{etiqueta: string, url: string, nota: string,
 *                  dentro: boolean, gana: string|null}>}
 */
export function filasVerificador(scope, registros = []) {
  return rutasDePrueba().map((ruta) => ({
    ...ruta,
    dentro: dentroDelScope(ruta.url, scope),
    gana: registroGanador(ruta.url, registros),
  }));
}
