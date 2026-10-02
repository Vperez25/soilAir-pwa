/**
 * services/dbService.js
 * -----------------------------------------------------------------------------
 * Bitácora de campo.  ->  IndexedDB (con la librería idb)
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
 *
 * POR QUÉ idb
 * La API nativa trabaja con eventos (onsuccess / onerror). idb la envuelve en
 * promesas, así que se escribe con async/await y un solo try/catch en la vista.
 *
 * Todo lo que toca IndexedDB vive en este archivo; las vistas solo llaman a las
 * cuatro funciones exportadas de abajo.
 */

// Copia local de idb 8.0.3 (ver el encabezado de vendor/idb.js). No se importa del
// CDN para que el App Shell que precachea sw.js sea autosuficiente.
import { openDB } from '../vendor/idb.js';

/** Nombre de la base de datos. */
const DB_NOMBRE = 'soilair';

/**
 * Versión del esquema. Cada vez que cambie la estructura (un store o un índice
 * nuevo) hay que SUBIRLA: IndexedDB solo ejecuta upgrade() cuando la versión
 * pedida es mayor que la que el navegador ya tiene guardada.
 */
const DB_VERSION = 1;

/** Object store de la bitácora. */
const STORE = 'bitacora';

/** Índice sobre el campo `cultivo`; es el que usa el filtro de la vista. */
const INDICE_CULTIVO = 'cultivo';

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
      },
    }).catch((error) => {
      conexion = null;
      throw error;
    });
  }

  return conexion;
}

/**
 * Crea una entrada nueva.
 *
 * @param {{cultivo: string, tipo: string, nota: string}} datos
 *        cultivo: id del cultivo (slug, p. ej. "chile-manzano")
 * @returns {Promise<{id: number, cultivo: string, tipo: string, nota: string, fecha: string}>}
 *          la entrada guardada, ya con el id que le asignó IndexedDB
 */
export async function crearEntrada({ cultivo, tipo, nota }) {
  const db = await abrir();
  const entrada = { cultivo, tipo, nota, fecha: new Date().toISOString() };

  // put() devuelve la clave generada; sin `id` en el objeto, se crea un registro.
  const id = await db.put(STORE, entrada);

  return { ...entrada, id };
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
 * Elimina una entrada. Si el id no existe no lanza nada: IndexedDB trata borrar
 * algo inexistente como una operación válida.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function eliminarEntrada(id) {
  const db = await abrir();
  await db.delete(STORE, id);
}
