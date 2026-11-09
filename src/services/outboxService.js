/**
 * services/outboxService.js
 * -----------------------------------------------------------------------------
 * Envío de la bitácora al servidor, también SIN conexión.
 *
 * ACCIÓN ELEGIDA: registrar una entrada de la bitácora de campo.
 *
 *   Datos     { idCliente, cultivo, tipo, nota, fecha, ubicacion?, referencia? }
 *   Endpoint  POST API_BITACORA (src/config.js), cuerpo JSON
 *   Éxito     cualquier 2xx; JSONPlaceholder responde 201 Created con un `id`
 *
 * REGLA: GUARDAR PRIMERO, ENVIAR DESPUÉS
 * La entrada nunca va directo a la red. Primero se escribe en IndexedDB (la
 * entrada en el store `bitacora` y su envío en el store `outbox`, en UNA
 * transacción, ver dbService.crearEntrada) y solo después se intenta mandar.
 * Si no hay red, o si el servidor falla, la entrada ya está a salvo y la
 * interfaz la muestra como pendiente.
 *
 * QUIÉN ENVÍA: DOS MODOS
 *
 *   background-sync  El navegador tiene SyncManager. La página solo registra
 *                    la tag TAG_SYNC con registration.sync.register(); el
 *                    navegador dispara el evento `sync` en el Service Worker
 *                    cuando hay red (aunque la pestaña ya esté cerrada) y sw.js
 *                    vacía la cola. Si un envío falla, sw.js rechaza waitUntil
 *                    y el navegador vuelve a intentarlo más tarde.
 *
 *   plan-b           Sin SyncManager (Firefox, Safari, todos los navegadores de
 *                    iPhone). La página envía la cola por su cuenta: al volver
 *                    la conexión (evento `online`), al abrir la app y con el
 *                    botón "Reintentar ahora". Solo funciona con la app abierta.
 *
 * En los dos modos un elemento se borra de la cola SOLO cuando el servidor
 * respondió 2xx; un error lo deja donde estaba, con un intento más.
 *
 * SIMULAR UN NAVEGADOR SIN SOPORTE
 * Abrir la app con ?plan-b en la URL (p. ej. /bitacora?plan-b) hace que la
 * detección responda "no hay SyncManager" aunque el navegador sí lo tenga.
 *
 * CONSTANTES COMPARTIDAS CON sw.js
 * TAG_SYNC, CANAL y CANDADO se repiten en sw.js (un worker clásico no puede
 * importar este módulo). Si se cambia una, hay que cambiarla en los dos.
 */

import { API_BITACORA } from '../config.js';
import { postJson } from './apiService.js';
import {
  crearEntrada,
  eliminarEntrada as eliminarEntradaDB,
  leerPendientes as leerPendientesDB,
  confirmarEnvio,
  registrarFallo,
} from './dbService.js';

/** Tag de Background Sync de la bitácora. La escucha sw.js en su evento `sync`. */
export const TAG_SYNC = 'soilair-sync-bitacora';

/** BroadcastChannel por el que el worker (y otras pestañas) avisan de cambios. */
const CANAL = 'soilair-outbox';

/** Web Lock que impide que el worker y la página manden la cola a la vez. */
const CANDADO = 'soilair-outbox';

/** Cuánto se espera a que haya un Service Worker activo antes de usar el plan B. */
const ESPERA_SW = 3000;

/** Prefijo de los mensajes de consola de este módulo. */
const ETIQUETA = '[outbox]';

/* ── Detección del modo ───────────────────────────────────────────────────── */

/** ¿Se pidió simular un navegador sin Background Sync? (ver ?plan-b arriba) */
const SIMULADO = new URLSearchParams(location.search).has('plan-b');

/**
 * ¿Este navegador tiene Background Sync? Es la detección que pide la consigna:
 * "SyncManager" in window. Se exige también serviceWorker, porque sin worker no
 * habría quién atendiera el evento `sync`.
 */
export function soportaBackgroundSync() {
  return !SIMULADO && 'serviceWorker' in navigator && 'SyncManager' in window;
}

/** Modo de envío de esta carga de la página: 'background-sync' o 'plan-b'. */
export const MODO = soportaBackgroundSync() ? 'background-sync' : 'plan-b';

/** Por qué se está en plan B: 'simulado' (?plan-b), 'sin-soporte' o null. */
export const MOTIVO_PLAN_B = MODO === 'plan-b' ? (SIMULADO ? 'simulado' : 'sin-soporte') : null;

/* ── Avisos de cambios ────────────────────────────────────────────────────── */

/** Funciones que quieren enterarse de cada cambio de la cola. */
const oyentes = new Set();

/** Resultado del último intento de envío, para mostrarlo en la interfaz. */
let ultimoResultado = null;

/** Canal compartido con sw.js y con las demás pestañas (si existe). */
const canal = 'BroadcastChannel' in self ? new BroadcastChannel(CANAL) : null;

/**
 * Avisa a la vista de que la cola cambió. Con `resultado`, además lo guarda
 * como el último resultado y lo reenvía a las otras pestañas abiertas.
 *
 * @param {Object|null} [resultado]
 * @param {{difundir?: boolean}} [opciones]
 */
function notificar(resultado = null, { difundir = true } = {}) {
  if (resultado) ultimoResultado = resultado;
  oyentes.forEach((oyente) => oyente(ultimoResultado));
  if (difundir) canal?.postMessage({ type: 'OUTBOX_CAMBIO', resultado });
}

/**
 * Pide que se le avise cada vez que la cola cambie (una entrada nueva, un envío
 * confirmado o fallido, desde esta página, desde otra o desde el worker).
 *
 * @param {(resultado: Object|null) => void} oyente
 * @returns {() => void} función para dejar de escuchar
 */
export function alCambiarCola(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Último resultado de envío conocido por esta página, o null. */
export function leerUltimoResultado() {
  return ultimoResultado;
}

/** Envíos que siguen pendientes, del más antiguo al más nuevo. */
export function leerPendientes() {
  return leerPendientesDB();
}

/**
 * Resultado de una pasada por la cola, con el texto que verá el usuario. El
 * worker manda los mismos campos crudos y aquí se redactan, para que los dos
 * caminos se lean igual en pantalla.
 *
 * @param {{enviados: number, fallidos: number, ultimoError?: string,
 *          origen: 'service-worker'|'pagina', ultimaOportunidad?: boolean}} datos
 */
function redactar({ enviados, fallidos, ultimoError, origen, ultimaOportunidad }) {
  // La cola ya estaba vacía: no hay nada que contar, solo se repinta.
  if (!enviados && !fallidos) return null;

  let quien = MODO === 'plan-b' ? 'la página (plan B)' : 'la página';
  if (origen === 'service-worker') quien = 'Background Sync (Service Worker)';
  const hora = new Date().toISOString();

  if (fallidos) {
    let siguiente = 'Se reintentará al volver la conexión, al abrir la app o con «Reintentar ahora».';
    if (origen === 'service-worker') {
      siguiente = ultimaOportunidad
        ? 'Era el último intento del navegador: se volverá a programar al abrir la app o con «Reintentar ahora».'
        : 'El navegador lo reintentará solo más tarde.';
    }

    return {
      tono: 'error',
      origen,
      enviados,
      fallidos,
      hora,
      texto: `${fallidos === 1 ? '1 envío falló' : `${fallidos} envíos fallaron`} (${ultimoError}) y ${fallidos === 1 ? 'sigue' : 'siguen'} en la cola. ${siguiente}`,
    };
  }

  return {
    tono: 'ok',
    origen,
    enviados,
    fallidos,
    hora,
    texto: `El servidor confirmó ${enviados === 1 ? '1 entrada' : `${enviados} entradas`}. Enviado por ${quien}; la cola quedó vacía.`,
  };
}

/* ── Envío desde la página (plan B y "Reintentar ahora") ─────────────────── */

/**
 * Ejecuta `trabajo` con el Web Lock de la cola, si el navegador lo tiene. El
 * worker usa el mismo candado: así un `sync` y un "Reintentar ahora" que caen
 * al mismo tiempo no mandan dos veces la misma entrada.
 */
function conCandado(trabajo) {
  return navigator.locks ? navigator.locks.request(CANDADO, trabajo) : trabajo();
}

/** Envío en curso en esta página; un segundo clic se suma al mismo. */
let enCurso = null;

/**
 * Recorre la cola y manda cada envío desde la página. Borra cada elemento SOLO
 * después de que el servidor confirme; si falla, lo deja con un intento más.
 *
 * @param {string} motivo quién lo pidió, para la consola ("online", "botón"…)
 * @returns {Promise<{enviados: number, fallidos: number}>}
 */
export function enviarPendientes(motivo) {
  if (!enCurso) {
    enCurso = conCandado(() => vaciarCola(motivo)).finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function vaciarCola(motivo) {
  // Se lee DENTRO del candado: si el worker acaba de vaciar la cola, aquí ya
  // llega vacía y no se repite nada.
  const pendientes = await leerPendientesDB();

  if (!pendientes.length) {
    console.log(`${ETIQUETA} ${motivo}: la cola está vacía`);
    notificar();
    return { enviados: 0, fallidos: 0 };
  }

  console.log(`${ETIQUETA} ${motivo}: enviando ${pendientes.length} pendiente(s) desde la página`);

  let enviados = 0;
  let fallidos = 0;
  let ultimoError = '';

  for (const pendiente of pendientes) {
    try {
      const { estado, datos } = await postJson(pendiente.url, pendiente.cuerpo);
      const idServidor = datos?.id ?? null;

      // SOLO aquí, con la respuesta 2xx en la mano, sale de la cola.
      await confirmarEnvio(pendiente, idServidor);
      enviados++;
      console.log(
        `${ETIQUETA} entrada #${pendiente.entradaId} confirmada por el servidor (HTTP ${estado}, id ${idServidor}); se borra de la cola`
      );
    } catch (error) {
      fallidos++;
      ultimoError = error.message;
      await registrarFallo(pendiente.id, error.message);
      console.warn(`${ETIQUETA} entrada #${pendiente.entradaId} NO se envió (${error.message}); sigue en la cola`);
    }
  }

  notificar(redactar({ enviados, fallidos, ultimoError, origen: 'pagina' }));
  return { enviados, fallidos };
}

/* ── Pedir un envío ───────────────────────────────────────────────────────── */

/** navigator.serviceWorker.ready, pero sin esperar para siempre. */
function workerListo() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('no hay un Service Worker activo')), ESPERA_SW)
    ),
  ]);
}

/**
 * Pide que se envíe la cola, con el mecanismo que toque según el modo.
 *
 *   background-sync  registra TAG_SYNC; el navegador avisará al worker.
 *   plan-b           si hay red, la manda la página ahora mismo.
 *
 * Si sync.register() falla (worker aún no activo, permiso denegado) se cae al
 * envío desde la página: la entrada ya está en la cola, así que nada se pierde.
 *
 * @param {string} motivo quién lo pidió, para la consola
 */
export async function solicitarEnvio(motivo) {
  if (MODO === 'background-sync') {
    try {
      const registro = await workerListo();
      await registro.sync.register(TAG_SYNC);
      console.log(`${ETIQUETA} ${motivo}: sync.register("${TAG_SYNC}")`);
      notificar(
        navigator.onLine
          ? null
          : {
              tono: 'info',
              origen: 'pagina',
              hora: new Date().toISOString(),
              texto: 'Sin conexión: la entrada quedó en la cola y el navegador la enviará cuando vuelva la red, aunque cierres la pestaña.',
            }
      );
      return;
    } catch (error) {
      console.warn(`${ETIQUETA} sync.register falló (${error.message}); se envía desde la página`);
    }
  }

  if (!navigator.onLine) {
    console.log(`${ETIQUETA} ${motivo}: sin conexión, la entrada espera en la cola`);
    notificar({
      tono: 'info',
      origen: 'pagina',
      hora: new Date().toISOString(),
      texto: 'Sin conexión: la entrada quedó en la cola. Se enviará al volver la red, al abrir la app o con «Reintentar ahora».',
    });
    return;
  }

  await enviarPendientes(motivo);
}

/**
 * Guarda una entrada nueva (y su envío pendiente) y DESPUÉS pide enviarla.
 *
 * Resuelve en cuanto la entrada está en IndexedDB; el envío sigue en segundo
 * plano y su resultado llega por alCambiarCola(). Así el formulario no espera
 * a la red, y si la red no está, no pasa nada.
 *
 * @param {{cultivo: string, tipo: string, nota: string,
 *          ubicacion?: Object|null, referencia?: string}} datos
 * @returns {Promise<Object>} la entrada guardada
 * @throws si IndexedDB no pudo guardarla (en ese caso no se intenta enviar)
 */
export async function registrarEntrada(datos) {
  // 1. Guardar primero.
  const { entrada } = await crearEntrada(datos, { url: API_BITACORA });
  console.log(`${ETIQUETA} entrada #${entrada.id} guardada en la cola (outbox)`);
  notificar();

  // 2. Enviar después, sin bloquear al formulario.
  solicitarEnvio('nueva entrada').catch((error) =>
    console.warn(`${ETIQUETA} no se pudo pedir el envío: ${error.message}`)
  );

  return entrada;
}

/**
 * Borra una entrada y, si seguía pendiente, también su envío (dbService lo hace
 * en una transacción). Avisa del cambio para que el panel deje de listarla.
 *
 * @param {number} id
 */
export async function eliminarEntrada(id) {
  await eliminarEntradaDB(id);
  notificar();
}

/* ── Arranque ─────────────────────────────────────────────────────────────── */

/**
 * Se llama una vez desde main.js. Conecta los avisos del worker y deja listos
 * los reintentos del plan B:
 *
 *   - evento `online`  (plan B) en cuanto vuelve la red se manda la cola.
 *   - al abrir la app  (los dos modos) si quedó algo pendiente se vuelve a
 *                      pedir el envío. En Background Sync esto también recupera
 *                      lo que el navegador dejó de reintentar tras su último
 *                      intento.
 *
 * El tercer reintento, el botón "Reintentar ahora", vive en PanelEnvios.js.
 */
export function iniciarEnvios() {
  console.log(
    `${ETIQUETA} modo de envío: ${MODO}` +
      (MOTIVO_PLAN_B === 'simulado' ? ' (simulado con ?plan-b)' : '') +
      ` · "SyncManager" in window: ${'SyncManager' in window}`
  );

  // Lo que avisa sw.js (o otra pestaña) por el BroadcastChannel.
  canal?.addEventListener('message', (evento) => {
    const dato = evento.data;
    if (dato?.type !== 'OUTBOX_CAMBIO') return;

    // El worker manda los números crudos; la redacción es la misma que la de
    // la página. Otra pestaña manda el resultado ya redactado.
    const resultado = dato.crudo ? redactar(dato.crudo) : dato.resultado;
    notificar(resultado, { difundir: false });
  });

  window.addEventListener('online', () => {
    if (MODO === 'plan-b') {
      enviarPendientes('evento online');
    } else {
      // En Background Sync lo dispara el navegador; aquí solo se repinta.
      notificar(null, { difundir: false });
    }
  });

  window.addEventListener('offline', () => notificar(null, { difundir: false }));

  // Al abrir la app.
  leerPendientesDB()
    .then((pendientes) => {
      if (pendientes.length) return solicitarEnvio('al abrir la app');
      return undefined;
    })
    .catch((error) => console.warn(`${ETIQUETA} no se pudo revisar la cola al abrir: ${error.message}`));
}
