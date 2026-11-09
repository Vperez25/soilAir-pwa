/**
 * services/dbService.js
 * -----------------------------------------------------------------------------
 * Bitácora de campo y cola de envíos.  ->  IndexedDB (con la librería idb)
 *
 * POR QUÉ INDEXEDDB Y NO LOS OTROS TRES MECANISMOS
 * Una bitácora es una LISTA de registros que crece, que el usuario consulta por
 * cultivo y de la que borra entradas sueltas. Ninguno de los tres mecanismos de
 * antes sirve para eso:
 *
 *   - localStorage / sessionStorage solo guardan texto bajo una clave: habría
 *     que serializar la lista entera a JSON, leerla completa para filtrar y
 *     reescribirla completa para borrar UNA entrada. Además son síncronos y se
 *     limitan a ~5 MB.
 *   - Una cookie viaja en cada petición y no pasa de ~4 KB.
 *
 * IndexedDB guarda objetos, tiene claves autogeneradas, permite consultar por un
 * índice sin leer todo y no bloquea la interfaz porque toda su API es asíncrona.
 * Además es el ÚNICO almacenamiento que también puede leer el Service Worker:
 * por eso la cola de envíos (outbox) vive aquí y no en localStorage.
 *
 * POR QUÉ idb
 * La API nativa trabaja con eventos (onsuccess / onerror). idb la envuelve en
 * promesas, así que se escribe con async/await y un solo try/catch en la vista.
 *
 * ESQUEMA
 *
 *   v1  bitacora   { id, cultivo, tipo, nota, fecha }          índice: cultivo
 *   v2  + outbox   { id, entradaId, url, cuerpo, creada,       índice: entradaId
 *                    intentos, ultimoError, ultimoIntento }
 *       y las entradas nuevas de bitacora llevan además
 *                  envio: { estado: 'pendiente' | 'enviada', idServidor, enviadaEn }
 *
 * Las entradas que se guardaron con la v1 no tienen `envio`: se conservan tal
 * cual y la vista las marca como "solo en este dispositivo".
 *
 * Las entradas pueden llevar además, opcionales:
 *                  ubicacion: { lat, lon, precision, fecha }   (GPS)
 *                  referencia: 'Parcela norte, surco 5'         (escrita)
 * No hizo falta subir la versión por eso: IndexedDB no fija los campos de cada
 * objeto, solo los stores y los índices, y ninguno de los dos cambió.
 *
 * Todo lo que toca IndexedDB desde la PÁGINA vive en este archivo. El Service
 * Worker (sw.js) abre la misma base con su propio código, porque no puede
 * importar módulos ES: si cambia el esquema, hay que cambiarlo en los dos.
 */

// Copia local de idb 8.0.3 (ver el encabezado de vendor/idb.js). No se importa del
// CDN para que el App Shell que precachea sw.js sea autosuficiente.
import { openDB } from '../vendor/idb.js';
import { avisar } from '../components/Aviso.js';

/** Nombre de la base de datos. */
const DB_NOMBRE = 'soilair';

/**
 * Versión del esquema. Cada vez que cambie la estructura (un store o un índice
 * nuevo) hay que SUBIRLA: IndexedDB solo ejecuta upgrade() cuando la versión
 * pedida es mayor que la que el navegador ya tiene guardada.
 *
 *   1  store bitacora
 *   2  store outbox (cola de envíos para Background Sync)
 *
 * Debe coincidir con DB_VERSION de sw.js.
 */
const DB_VERSION = 2;

/** Object store de la bitácora. */
const STORE = 'bitacora';

/** Object store de la cola de envíos pendientes. */
const OUTBOX = 'outbox';

/** Índice sobre el campo `cultivo`; es el que usa el filtro de la vista. */
const INDICE_CULTIVO = 'cultivo';

/** Índice de outbox sobre `entradaId`: para borrar el envío de una entrada. */
const INDICE_ENTRADA = 'entradaId';

/**
 * Promesa de la conexión, compartida por todas las funciones. Abrir la base es
 * lo más caro de IndexedDB, así que se hace una vez y se reutiliza.
 *
 * @type {Promise<import('idb').IDBPDatabase>|null}
 */
let conexion = null;

/**
 * Abre (o crea) la base de datos.
 *
 * Si la apertura falla (navegación privada en Firefox antiguo, datos de sitio
 * bloqueados) se descarta la promesa rechazada: de lo contrario la app se
 * quedaría con ese error para siempre y el botón "Reintentar" no serviría.
 */
function abrir() {
  if (!conexion) {
    conexion = openDB(DB_NOMBRE, DB_VERSION, {
      /**
       * Solo corre cuando la base NO existe todavía o su versión es menor a
       * DB_VERSION. Es el único lugar donde IndexedDB permite crear stores e
       * índices.
       *
       * Cada bloque `if` es UN paso de migración y se ejecutan en orden: quien
       * no tenía la base pasa por los dos; quien ya tenía la v1 solo por el
       * segundo. Ningún paso borra ni recrea un store existente, así que las
       * entradas que ya estaban guardadas no se pierden.
       */
      upgrade(db, versionAnterior) {
        if (versionAnterior < 1) {
          // keyPath 'id' + autoIncrement: el navegador asigna 1, 2, 3… al
          // guardar, así que el formulario no tiene que inventar identificadores.
          const bitacora = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });

          // Sin este índice, filtrar por cultivo obligaría a leer TODAS las
          // entradas y descartar en JS las que no coinciden.
          bitacora.createIndex(INDICE_CULTIVO, 'cultivo');
        }

        if (versionAnterior < 2) {
          // v2: SOLO se agrega la cola. El store de la bitácora no se toca.
          // autoIncrement también aquí: el orden de los id es el orden de envío.
          const outbox = db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true });
          outbox.createIndex(INDICE_ENTRADA, 'entradaId');
        }
      },

      /**
       * Otra pestaña sigue abierta con la versión anterior y no suelta la base:
       * la actualización espera a que se cierre. Sin este aviso la bitácora se
       * quedaría en "Cargando…" sin explicación.
       */
      blocked() {
        avisar(
          'Hay otra pestaña de SoilAir abierta con una versión anterior. Ciérrala para terminar de actualizar la bitácora.',
          { clave: 'idb-bloqueada' }
        );
      },

      /**
       * Al revés: ESTA pestaña es la vieja y otra pide una versión más nueva.
       * Se cierra la conexión para no bloquearla; la próxima operación abre
       * una conexión nueva.
       */
      blocking() {
        conexion?.then((db) => db.close());
        conexion = null;
      },
    }).catch((error) => {
      conexion = null;
      throw error;
    });
  }

  return conexion;
}

/* ── Bitácora ─────────────────────────────────────────────────────────────── */

/**
 * Crea una entrada nueva Y deja su envío en la cola, en UNA sola transacción
 * sobre los dos stores: o se guardan las dos cosas o ninguna. Así nunca queda
 * una entrada marcada como pendiente que no esté en la cola, ni un envío de una
 * entrada que no existe.
 *
 * Esta función NO toca la red: solo guarda. El envío lo intenta después
 * services/outboxService.js.
 *
 * @param {{cultivo: string, tipo: string, nota: string,
 *          ubicacion?: Object|null, referencia?: string}} datos
 *        cultivo: id del cultivo (slug, p. ej. "chile-manzano")
 *        ubicacion / referencia: opcionales (ver CampoUbicacion.js)
 * @param {{url: string}} envio endpoint al que se mandará la entrada
 * @returns {Promise<{entrada: Object, pendiente: Object}>} los dos registros
 *          guardados, ya con el id que les asignó IndexedDB
 */
export async function crearEntrada({ cultivo, tipo, nota, ubicacion = null, referencia = '' }, { url }) {
  const db = await abrir();

  const fecha = new Date().toISOString();

  // Los opcionales solo se guardan si vienen: así una entrada sin ubicación se
  // ve igual que las de antes.
  const extra = {};
  if (ubicacion) extra.ubicacion = ubicacion;
  if (referencia) extra.referencia = referencia;

  const entrada = { cultivo, tipo, nota, ...extra, fecha, envio: { estado: 'pendiente' } };

  // Todo lo que no es IndexedDB se calcula ANTES de abrir la transacción: una
  // transacción se cierra sola en cuanto deja de tener peticiones en curso.
  const idCliente = crypto.randomUUID();

  const tx = db.transaction([STORE, OUTBOX], 'readwrite');

  // add() devuelve la clave generada; la necesita el envío para apuntar a ella.
  const id = await tx.objectStore(STORE).add(entrada);

  const pendiente = {
    entradaId: id,
    url,
    // Lo que viaja al servidor. idCliente identifica la entrada aunque se
    // mande dos veces (un reintento tras perder la respuesta): con él el
    // servidor puede descartar el duplicado.
    cuerpo: { idCliente, cultivo, tipo, nota, ...extra, fecha },
    creada: fecha,
    intentos: 0,
    ultimoError: null,
    ultimoIntento: null,
  };

  const idPendiente = await tx.objectStore(OUTBOX).add(pendiente);
  await tx.done;

  return { entrada: { ...entrada, id }, pendiente: { ...pendiente, id: idPendiente } };
}

/**
 * Lee todas las entradas, en el orden en que se crearon.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function leerEntradas() {
  const db = await abrir();
  return db.getAll(STORE);
}

/**
 * Lee solo las entradas de un cultivo, consultando el índice.
 *
 * @param {string} cultivo id del cultivo (slug)
 * @returns {Promise<Array<Object>>}
 */
export async function leerEntradasDeCultivo(cultivo) {
  const db = await abrir();
  return db.getAllFromIndex(STORE, INDICE_CULTIVO, cultivo);
}

/**
 * Elimina una entrada y, si aún no se había enviado, también su envío
 * pendiente: borrar una nota que todavía está en la cola significa que ya no
 * se quiere mandar. Si el id no existe no lanza nada.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function eliminarEntrada(id) {
  const db = await abrir();
  const tx = db.transaction([STORE, OUTBOX], 'readwrite');
  const outbox = tx.objectStore(OUTBOX);

  const claves = await outbox.index(INDICE_ENTRADA).getAllKeys(id);
  await Promise.all([
    tx.objectStore(STORE).delete(id),
    ...claves.map((clave) => outbox.delete(clave)),
  ]);
  await tx.done;
}

/* ── Cola de envíos (outbox) ──────────────────────────────────────────────── */

/**
 * Envíos que siguen sin confirmar, del más antiguo al más nuevo.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function leerPendientes() {
  const db = await abrir();
  return db.getAll(OUTBOX);
}

/**
 * El servidor confirmó el envío: se borra de la cola y la entrada queda marcada
 * como enviada. Las dos cosas en UNA transacción.
 *
 * Si mientras viajaba la petición el usuario borró la entrada, no se vuelve a
 * crear: solo se limpia la cola.
 *
 * @param {{id: number, entradaId: number}} pendiente
 * @param {number|string|null} idServidor id que devolvió el servidor
 */
export async function confirmarEnvio(pendiente, idServidor) {
  const db = await abrir();
  const tx = db.transaction([STORE, OUTBOX], 'readwrite');
  const entradas = tx.objectStore(STORE);

  await tx.objectStore(OUTBOX).delete(pendiente.id);

  const entrada = await entradas.get(pendiente.entradaId);
  if (entrada) {
    await entradas.put({
      ...entrada,
      envio: { estado: 'enviada', idServidor, enviadaEn: new Date().toISOString() },
    });
  }

  await tx.done;
}

/**
 * El envío falló: se queda en la cola con un intento más y el motivo, para que
 * la interfaz pueda decir por qué sigue pendiente.
 *
 * @param {number} idPendiente
 * @param {string} motivo
 */
export async function registrarFallo(idPendiente, motivo) {
  const db = await abrir();
  const tx = db.transaction(OUTBOX, 'readwrite');
  const pendiente = await tx.store.get(idPendiente);

  if (pendiente) {
    await tx.store.put({
      ...pendiente,
      intentos: (pendiente.intentos ?? 0) + 1,
      ultimoError: motivo,
      ultimoIntento: new Date().toISOString(),
    });
  }

  await tx.done;
}
