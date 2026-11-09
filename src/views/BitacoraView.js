/**
 * views/BitacoraView.js
 * -----------------------------------------------------------------------------
 * Ruta "/bitacora" — notas de campo por cultivo, guardadas en IndexedDB.
 *
 * Es la contraparte visible de services/dbService.js y services/outboxService.js.
 * La vista no sabe nada de IndexedDB ni de Background Sync: solo llama a los
 * servicios y decide qué HTML corresponde a cada resultado.
 *
 *   - Formulario  -> registrarEntrada()  (guarda en la cola y LUEGO pide enviar)
 *   - Listado     -> leerEntradas()  /  leerEntradasDeCultivo() cuando hay filtro
 *   - Eliminar    -> eliminarEntrada()   (también la saca de la cola)
 *   - Envíos      -> components/PanelEnvios.js
 *   - Ubicación   -> components/CampoUbicacion.js (usa services/ubicacionService.js)
 *   - Compartir   -> services/compartirService.js (Web Share o portapapeles)
 *
 * Los datos sobreviven a un F5 porque viven en IndexedDB, no en la página: al
 * montar la vista se vuelven a leer de la base. Cada entrada lleva una insignia
 * con su estado de envío: pendiente, enviada (con el id del servidor) o, si se
 * guardó antes de que existiera la cola, solo en este dispositivo.
 *
 * ERRORES
 * Cada escritura (guardar y eliminar) va en try/catch y, si falla, el usuario lo
 * ve en pantalla. Al fallar guardar NO se vacía el formulario: lo escrito sigue
 * ahí para reintentar sin teclear la nota otra vez. Un fallo de RED no es un
 * error al guardar: la entrada ya quedó en la cola y se enviará después.
 */

import { leerEntradas, leerEntradasDeCultivo } from '../services/dbService.js';
import { registrarEntrada, eliminarEntrada, alCambiarCola } from '../services/outboxService.js';
import { CULTIVOS } from '../services/cultivosIndex.js';
import { avisar } from '../components/Aviso.js';
import { PanelEnvios, montarPanelEnvios } from '../components/PanelEnvios.js';
import { CampoUbicacion, montarCampoUbicacion, MAX_REFERENCIA } from '../components/CampoUbicacion.js';
import { coordenadas, enlaceMapa } from '../services/ubicacionService.js';
import { compartir, soportaCompartir } from '../services/compartirService.js';
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

/** Corta un texto largo para mostrarlo en una sola línea. */
function recortar(texto, maximo) {
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1)}…` : limpio;
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

        ${CampoUbicacion()}
      </div>

      <div class="bitacora-form__pie">
        <button type="submit" class="clima-boton">Guardar entrada</button>
        <p id="bitacora-mensaje" class="bitacora-mensaje" role="status"></p>
      </div>
    </form>
  `;
}

/**
 * Insignia con el estado de envío de una entrada. Las entradas de la v1 de la
 * base no tienen `envio`: se guardaron antes de que existiera la cola.
 */
function EstadoEnvio(envio) {
  if (envio?.estado === 'pendiente') {
    return '<span class="envio-insignia envio-insignia--pendiente">Pendiente de envío</span>';
  }

  if (envio?.estado === 'enviada') {
    const id = envio.idServidor ?? '—';
    return `<span class="envio-insignia envio-insignia--enviada">Enviada · id servidor ${escaparHtml(id)}</span>`;
  }

  return '<span class="envio-insignia">Solo en este dispositivo</span>';
}

/** ¿La ubicación guardada tiene coordenadas utilizables? */
function tieneUbicacion(entrada) {
  return Number.isFinite(entrada.ubicacion?.lat) && Number.isFinite(entrada.ubicacion?.lon);
}

/** Línea "Lugar": referencia escrita y/o coordenadas con enlace al mapa. */
function Lugar(entrada) {
  const partes = [];

  if (entrada.referencia) partes.push(escaparHtml(entrada.referencia));

  if (tieneUbicacion(entrada)) {
    const u = entrada.ubicacion;
    partes.push(`
      <span class="bitacora-entrada__coords">${escaparHtml(coordenadas(u))} · ±${escaparHtml(u.precision)} m</span>
      <a href="${escaparHtml(enlaceMapa(u))}" target="_blank" rel="noopener">Ver en el mapa</a>
    `);
  }

  if (!partes.length) return '';

  return `
    <p class="bitacora-entrada__lugar">
      <span class="bitacora-entrada__lugar-etiqueta">Lugar</span>
      ${partes.join(' · ')}
    </p>
  `;
}

/**
 * Lo que se comparte de una entrada: un título, el texto (nota, fecha y lugar)
 * y, si tiene coordenadas, el enlace al mapa como `url`.
 */
function datosParaCompartir(entrada) {
  const lineas = [entrada.nota, `Fecha: ${fecha(entrada.fecha)}`];
  if (entrada.referencia) lineas.push(`Lugar: ${entrada.referencia}`);
  if (tieneUbicacion(entrada)) {
    lineas.push(`Ubicación: ${coordenadas(entrada.ubicacion)} (±${entrada.ubicacion.precision} m)`);
  }

  const datos = {
    title: `SoilAir · ${nombreCultivo(entrada.cultivo)} — ${TIPOS[entrada.tipo] ?? entrada.tipo}`,
    text: lineas.join('\n'),
  };
  if (tieneUbicacion(entrada)) datos.url = enlaceMapa(entrada.ubicacion);

  return datos;
}

/** Qué se le dice al usuario según cómo terminó el intento de compartir. */
const RESULTADO_COMPARTIR = {
  compartido: { tono: 'aviso', texto: 'Entrada compartida.' },
  // AbortError: cerró el menú. No es un error.
  cancelado: { tono: 'aviso', texto: 'Cancelaste el envío; no se compartió nada.' },
  copiado: {
    tono: 'aviso',
    // Se copia también si hay menú pero no aceptó los datos (canShare) o falló.
    get texto() {
      return soportaCompartir()
        ? 'No se pudo abrir el menú para compartir: el texto de la entrada se copió al portapapeles.'
        : 'Este navegador no tiene menú para compartir: el texto de la entrada se copió al portapapeles. Pégalo en WhatsApp o en un correo.';
    },
  },
};

function Entrada(entrada) {
  const cultivo = nombreCultivo(entrada.cultivo);
  const cuando = fecha(entrada.fecha);
  // Sin menú nativo el botón dice lo que de verdad va a pasar.
  const etiquetaCompartir = soportaCompartir() ? 'Compartir' : 'Copiar para compartir';

  return `
    <li class="bitacora-entrada bitacora-entrada--${escaparHtml(entrada.envio?.estado ?? 'local')}">
      <div class="bitacora-entrada__meta">
        <span class="bitacora-entrada__cultivo">${escaparHtml(cultivo)}</span>
        <span class="bitacora-etiqueta">${escaparHtml(TIPOS[entrada.tipo] ?? entrada.tipo)}</span>
        ${EstadoEnvio(entrada.envio)}
        <time class="bitacora-entrada__fecha" datetime="${escaparHtml(entrada.fecha)}">
          ${escaparHtml(cuando)}
        </time>
      </div>

      <p class="bitacora-entrada__nota">${escaparHtml(entrada.nota)}</p>

      ${Lugar(entrada)}

      <div class="bitacora-entrada__acciones">
        <button
          type="button"
          class="clima-boton"
          data-compartir="${escaparHtml(entrada.id)}"
          aria-label="${escaparHtml(etiquetaCompartir)}: entrada de ${escaparHtml(cultivo)} del ${escaparHtml(cuando)}"
        >
          ${escaparHtml(etiquetaCompartir)}
        </button>
        <button
          type="button"
          class="clima-boton"
          data-eliminar="${escaparHtml(entrada.id)}"
          aria-label="Eliminar la entrada de ${escaparHtml(cultivo)} del ${escaparHtml(cuando)}"
        >
          Eliminar
        </button>
      </div>
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
      <p class="portada__eyebrow">IndexedDB · cola sin conexión · ubicación · compartir</p>
      <h1 class="portada__titulo">Bitácora de campo</h1>
      <p class="portada__texto">
        Anota lo que se hizo o se observó en cada cultivo: un riego, una
        fertilización, una plaga. Puedes marcar el punto de la parcela con tu
        ubicación y compartir la entrada con el agrónomo. Cada entrada se guarda
        primero en este navegador y después se envía al servidor; si no hay
        conexión, espera en la cola y se manda en cuanto vuelva la red.
      </p>
    </section>

    ${PanelEnvios()}

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

  const campoUbicacion = montarCampoUbicacion(contenedor, { vigente });

  /** Entradas pintadas, por id: el botón Compartir toma de aquí sus datos. */
  let visibles = new Map();

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
      visibles = new Map(entradas.map((entrada) => [entrada.id, entrada]));
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
    const referencia = String(datos.get('referencia') ?? '').trim().slice(0, MAX_REFERENCIA);
    const ubicacion = campoUbicacion.leer();

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
      // Resuelve en cuanto la entrada está en IndexedDB (entrada + cola). El
      // envío sigue por su cuenta y su resultado lo muestra el panel.
      await registrarEntrada({ cultivo, tipo, nota, ubicacion, referencia });
    } catch (error) {
      // El formulario NO se vacía: el usuario conserva lo que escribió.
      decir(`No se pudo guardar la entrada. ${explicar(error)}`, 'error');
      return;
    } finally {
      boton.disabled = false;
    }

    formulario.reset();
    campoUbicacion.limpiar();

    // Con un filtro activo de otro cultivo, la entrada recién guardada quedaría
    // fuera de la lista y parecería que no se guardó.
    if (filtro.value && filtro.value !== cultivo) filtro.value = '';

    decir(
      `Entrada de ${nombreCultivo(cultivo)} guardada${ubicacion ? ' con su ubicación' : ''} y puesta en la cola de envío.`
    );
    await pintar();
  });

  /* Filtrar ---------------------------------------------------------------- */

  filtro.addEventListener('change', pintar);

  /* Compartir, eliminar y reintentar --------------------------------------- */

  // Un solo escuchador sobre el contenedor: la lista se reescribe entera en
  // cada consulta, así que uno puesto en cada botón se perdería.
  lista.addEventListener('click', async (evento) => {
    if (evento.target.closest('[data-accion="reintentar"]')) {
      await pintar();
      return;
    }

    const botonCompartir = evento.target.closest('[data-compartir]');
    if (botonCompartir) {
      const entrada = visibles.get(Number(botonCompartir.dataset.compartir));
      if (!entrada) return;

      botonCompartir.disabled = true;
      try {
        // Se llama dentro del clic: navigator.share exige un gesto del usuario.
        const resultado = await compartir(datosParaCompartir(entrada));
        avisar(RESULTADO_COMPARTIR[resultado].texto, { tono: RESULTADO_COMPARTIR[resultado].tono });
      } catch {
        avisar('No se pudo compartir ni copiar la entrada. Selecciona el texto y cópialo a mano.', {
          tono: 'error',
        });
      } finally {
        botonCompartir.disabled = false;
      }
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

  /* Envíos ----------------------------------------------------------------- */

  // Cada cambio de la cola (envío confirmado, fallido, entrada nueva desde otra
  // pestaña) cambia las insignias de la lista: se vuelve a leer.
  const dejar = alCambiarCola(() => {
    if (!vigente()) {
      dejar();
      return;
    }
    pintar();
  });

  await Promise.all([
    pintar(),
    montarPanelEnvios(contenedor, {
      vigente,
      describir: (pendiente) => ({
        titulo: `${nombreCultivo(pendiente.cuerpo?.cultivo)} · ${TIPOS[pendiente.cuerpo?.tipo] ?? pendiente.cuerpo?.tipo ?? ''}`,
        detalle: recortar(pendiente.cuerpo?.nota ?? '', 90),
      }),
    }),
  ]);
};
