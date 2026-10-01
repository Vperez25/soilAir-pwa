/**
 * views/BitacoraView.js
 * -----------------------------------------------------------------------------
 * Ruta "/bitacora" — notas de campo por cultivo, guardadas en IndexedDB.
 *
 * Es la contraparte visible de services/dbService.js. La vista no sabe nada de
 * IndexedDB: solo llama a las cuatro funciones del servicio y decide qué HTML
 * corresponde a cada resultado.
 *
 *   - Formulario  -> crearEntrada()
 *   - Listado     -> leerEntradas()  /  leerEntradasDeCultivo() cuando hay filtro
 *   - Eliminar    -> eliminarEntrada()
 *
 * Los datos sobreviven a un F5 porque viven en IndexedDB, no en la página: al
 * montar la vista se vuelven a leer de la base.
 *
 * ERRORES
 * Cada escritura (guardar y eliminar) va en try/catch y, si falla, el usuario lo
 * ve en pantalla. Al fallar guardar NO se vacía el formulario: lo escrito sigue
 * ahí para reintentar sin teclear la nota otra vez.
 */

import {
  crearEntrada,
  leerEntradas,
  leerEntradasDeCultivo,
  eliminarEntrada,
} from '../services/dbService.js';
import { CULTIVOS } from '../services/cultivosIndex.js';
import { avisar } from '../components/Aviso.js';
import { slugify } from '../utils/slugify.js';
import { escaparHtml } from '../utils/escapar.js';

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Largo máximo de la nota; el mismo valor va en el maxlength del textarea. */
const MAX_NOTA = 280;

/** Tipos de entrada: valor guardado en la base -> texto que ve el usuario. */
const TIPOS = {
  riego: 'Riego',
  fertilizacion: 'Fertilización',
  plagas: 'Plagas y enfermedades',
  cosecha: 'Cosecha',
  observacion: 'Observación',
};

/**
 * Cultivos disponibles: id (el mismo slug de la URL del detalle) -> nombre.
 * Lo que se guarda en la base es el id, no el nombre, para que un cambio de
 * redacción en el catálogo no deje huérfanas las entradas ya guardadas.
 */
const NOMBRES = new Map(CULTIVOS.map((cultivo) => [slugify(cultivo.nombre), cultivo.nombre]));

/* ── Utilidades ───────────────────────────────────────────────────────────── */

/** Nombre legible de un cultivo; si el id ya no existe en el catálogo, el id. */
function nombreCultivo(id) {
  return NOMBRES.get(id) ?? id;
}

/** Fecha ISO -> texto legible. Devuelve el crudo si no se puede interpretar. */
function fecha(iso) {
  const momento = new Date(iso);
  return Number.isNaN(momento.getTime()) ? String(iso) : FECHA.format(momento);
}

/** Explica un fallo de IndexedDB en términos que el usuario pueda atender. */
function explicar(error) {
  const cuotaLlena = error?.name === 'QuotaExceededError';

  return cuotaLlena
    ? 'El almacenamiento del navegador está lleno. Libera espacio e inténtalo de nuevo.'
    : 'El navegador no dejó usar la base de datos local; puede estar bloqueada o ser una ventana privada. Inténtalo de nuevo.';
}

/** "1 entrada" / "3 entradas". */
function contar(total) {
  return total === 1 ? '1 entrada' : `${total} entradas`;
}

/* ── Marcado ──────────────────────────────────────────────────────────────── */

const OpcionesCultivo = () =>
  [...NOMBRES]
    .map(([id, nombre]) => `<option value="${escaparHtml(id)}">${escaparHtml(nombre)}</option>`)
    .join('');

const OpcionesTipo = () =>
  Object.entries(TIPOS)
    .map(([valor, texto]) => `<option value="${escaparHtml(valor)}">${escaparHtml(texto)}</option>`)
    .join('');

function Formulario() {
  return `
    <form id="bitacora-form" class="bitacora-form" autocomplete="off">
      <h2 class="bitacora-form__titulo">Nueva entrada</h2>

      <div class="bitacora-form__campos">
        <label class="campo">
          <span class="campo__etiqueta">Cultivo</span>
          <select class="campo__control" name="cultivo" required>
            <option value="">Elige un cultivo</option>
            ${OpcionesCultivo()}
          </select>
        </label>

        <label class="campo">
          <span class="campo__etiqueta">Tipo</span>
          <select class="campo__control" name="tipo" required>
            ${OpcionesTipo()}
          </select>
        </label>

        <label class="campo campo--ancho">
          <span class="campo__etiqueta">Nota</span>
          <textarea
            class="campo__control"
            name="nota"
            rows="3"
            maxlength="${MAX_NOTA}"
            required
            placeholder="Qué se hizo o qué se observó en la parcela"
          ></textarea>
        </label>
      </div>

      <div class="bitacora-form__pie">
        <button type="submit" class="clima-boton">Guardar entrada</button>
        <p id="bitacora-mensaje" class="bitacora-mensaje" role="status"></p>
      </div>
    </form>
  `;
}

function Entrada(entrada) {
  const cultivo = nombreCultivo(entrada.cultivo);
  const cuando = fecha(entrada.fecha);

  return `
    <li class="bitacora-entrada">
      <div class="bitacora-entrada__meta">
        <span class="bitacora-entrada__cultivo">${escaparHtml(cultivo)}</span>
        <span class="bitacora-etiqueta">${escaparHtml(TIPOS[entrada.tipo] ?? entrada.tipo)}</span>
        <time class="bitacora-entrada__fecha" datetime="${escaparHtml(entrada.fecha)}">
          ${escaparHtml(cuando)}
        </time>
      </div>

      <p class="bitacora-entrada__nota">${escaparHtml(entrada.nota)}</p>

      <button
        type="button"
        class="clima-boton"
        data-eliminar="${escaparHtml(entrada.id)}"
        aria-label="Eliminar la entrada de ${escaparHtml(cultivo)} del ${escaparHtml(cuando)}"
      >
        Eliminar
      </button>
    </li>
  `;
}

/** Lista de entradas, o el mensaje de que no hay ninguna que mostrar. */
function Lista(entradas, cultivoFiltrado) {
  if (!entradas.length) {
    return `
      <p class="clima-vacio">
        ${
          cultivoFiltrado
            ? `Todavía no hay entradas de ${escaparHtml(nombreCultivo(cultivoFiltrado))}.`
            : 'Todavía no hay entradas. Guarda la primera con el formulario de arriba.'
        }
      </p>
    `;
  }

  // Las más recientes primero: el id crece con cada entrada nueva.
  const recientes = [...entradas].sort((a, b) => b.id - a.id);

  return `<ul class="bitacora-lista">${recientes.map(Entrada).join('')}</ul>`;
}

function ErrorLectura(error) {
  return `
    <div class="clima-error" role="alert">
      <p class="clima-error__titulo">No se pudo abrir la bitácora</p>
      <p class="clima-error__texto">${escaparHtml(explicar(error))}</p>
      <button type="button" class="clima-boton" data-accion="reintentar">Reintentar</button>
    </div>
  `;
}

/* ── Vista ────────────────────────────────────────────────────────────────── */

export function BitacoraView() {
  return `
    <section class="portada">
      <p class="portada__eyebrow">Guardado en este dispositivo · IndexedDB</p>
      <h1 class="portada__titulo">Bitácora de campo</h1>
      <p class="portada__texto">
        Anota lo que se hizo o se observó en cada cultivo: un riego, una
        fertilización, una plaga. Las entradas se quedan en este navegador y
        siguen ahí después de recargar la página.
      </p>
    </section>

    ${Formulario()}

    <div class="clima-barra">
      <span id="bitacora-conteo">Leyendo la bitácora…</span>

      <label class="clima-filtro">
        <span class="clima-filtro__etiqueta">Filtrar</span>
        <select class="clima-filtro__campo" data-filtro aria-label="Filtrar las entradas por cultivo">
          <option value="">Todos los cultivos</option>
          ${OpcionesCultivo()}
        </select>
      </label>
    </div>

    <div id="bitacora-lista" aria-live="polite">
      <p class="cargando">Cargando…</p>
    </div>
  `;
}

/**
 * Gancho que ejecuta el router DESPUÉS de montar el HTML de arriba.
 *
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 */
BitacoraView.montar = async ({ contenedor, vigente }) => {
  const formulario = contenedor.querySelector('#bitacora-form');
  const mensaje = contenedor.querySelector('#bitacora-mensaje');
  const filtro = contenedor.querySelector('[data-filtro]');
  const conteo = contenedor.querySelector('#bitacora-conteo');
  const lista = contenedor.querySelector('#bitacora-lista');
  if (!formulario || !mensaje || !filtro || !conteo || !lista) return;

  // Cada consulta lleva un número. Si el usuario cambia el filtro dos veces
  // seguidas, la primera respuesta puede llegar DESPUÉS de la segunda; con el
  // número, solo pinta la última que se pidió.
  let consulta = 0;

  /** Mensaje junto al formulario. Sin texto, se limpia. */
  const decir = (texto, tono = 'ok') => {
    mensaje.textContent = texto;
    mensaje.className = texto ? `bitacora-mensaje bitacora-mensaje--${tono}` : 'bitacora-mensaje';
  };

  /**
   * Lee de la base lo que corresponde al filtro y lo pinta. Con el filtro en
   * "Todos" lee todo; con un cultivo elegido consulta el índice.
   */
  async function pintar() {
    const turno = ++consulta;
    const cultivo = filtro.value;

    try {
      const entradas = cultivo ? await leerEntradasDeCultivo(cultivo) : await leerEntradas();

      // Respuesta vieja, o el usuario ya cambió de vista: no se pinta nada.
      if (turno !== consulta || !vigente()) return;

      conteo.textContent = cultivo
        ? `${contar(entradas.length)} · ${nombreCultivo(cultivo)}`
        : contar(entradas.length);
      lista.innerHTML = Lista(entradas, cultivo);
    } catch (error) {
      if (turno !== consulta || !vigente()) return;

      conteo.textContent = 'Sin acceso a la bitácora';
      lista.innerHTML = ErrorLectura(error);
    }
  }

  /* Guardar ---------------------------------------------------------------- */

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    decir('');

    const datos = new FormData(formulario);
    const cultivo = String(datos.get('cultivo'));
    const tipo = String(datos.get('tipo'));
    const nota = String(datos.get('nota')).trim();

    // `required` deja pasar una nota hecha solo de espacios.
    if (!nota) {
      decir('Escribe una nota antes de guardar.', 'error');
      formulario.elements.nota.focus();
      return;
    }

    if (!NOMBRES.has(cultivo) || !(tipo in TIPOS)) {
      decir('Elige un cultivo y un tipo de entrada válidos.', 'error');
      return;
    }

    const boton = formulario.querySelector('[type="submit"]');
    boton.disabled = true;

    try {
      await crearEntrada({ cultivo, tipo, nota });
    } catch (error) {
      // El formulario NO se vacía: el usuario conserva lo que escribió.
      decir(`No se pudo guardar la entrada. ${explicar(error)}`, 'error');
      return;
    } finally {
      boton.disabled = false;
    }

    formulario.reset();

    // Con un filtro activo de otro cultivo, la entrada recién guardada quedaría
    // fuera de la lista y parecería que no se guardó.
    if (filtro.value && filtro.value !== cultivo) filtro.value = '';

    decir(`Entrada guardada en ${nombreCultivo(cultivo)}.`);
    await pintar();
  });

  /* Filtrar ---------------------------------------------------------------- */

  filtro.addEventListener('change', pintar);

  /* Eliminar y reintentar -------------------------------------------------- */

  // Un solo escuchador sobre el contenedor: la lista se reescribe entera en
  // cada consulta, así que uno puesto en cada botón se perdería.
  lista.addEventListener('click', async (evento) => {
    if (evento.target.closest('[data-accion="reintentar"]')) {
      await pintar();
      return;
    }

    const boton = evento.target.closest('[data-eliminar]');
    if (!boton) return;

    boton.disabled = true;

    try {
      await eliminarEntrada(Number(boton.dataset.eliminar));
    } catch (error) {
      boton.disabled = false;
      // Aviso fijo en pantalla: el mensaje del formulario podría estar fuera de
      // la vista si la lista es larga.
      avisar(`No se pudo eliminar la entrada. ${explicar(error)}`, { tono: 'error' });
      return;
    }

    await pintar();
  });

  await pintar();
};
