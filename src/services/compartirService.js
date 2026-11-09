/**
 * services/compartirService.js
 * -----------------------------------------------------------------------------
 * Compartir contenido de la app: Web Share API con plan B (portapapeles).
 *
 * CASO DE USO
 * Una entrada de la Bitácora de campo (por ejemplo, una plaga con la ubicación
 * del surco) se manda al agrónomo por WhatsApp o correo desde el menú nativo
 * del teléfono. Si el navegador no tiene ese menú, el texto se copia para
 * pegarlo donde haga falta.
 *
 * Orden de decisión:
 *
 *   1. ¿Existe navigator.share?                 no -> copiar
 *   2. ¿canShare(datos) acepta estos datos?     no -> copiar
 *   3. navigator.share(datos)
 *        se resuelve                            -> 'compartido'
 *        AbortError (cerró el menú)             -> 'cancelado' (NO se copia)
 *        otro error (NotAllowedError…)          -> copiar
 */

/** ¿Hay menú nativo para compartir? (Android, iOS, Windows, macOS) */
export function soportaCompartir() {
  return typeof navigator.share === 'function';
}

/**
 * Texto plano equivalente a los datos, para el portapapeles.
 *
 * @param {{title?: string, text?: string, url?: string}} datos
 */
export function comoTexto({ title, text, url }) {
  return [title, text, url].filter(Boolean).join('\n');
}

/**
 * Comparte con el menú nativo o, si no se puede, copia al portapapeles.
 * Tiene que llamarse desde un clic: navigator.share exige un gesto del usuario.
 *
 * @param {{title?: string, text?: string, url?: string}} datos
 * @returns {Promise<'compartido'|'cancelado'|'copiado'>}
 * @throws {Error} solo si tampoco se pudo copiar
 */
export async function compartir(datos) {
  if (soportaCompartir()) {
    // canShare no existe en algunos navegadores viejos que sí tienen share;
    // ahí se intenta directamente.
    const valido = typeof navigator.canShare === 'function' ? navigator.canShare(datos) : true;

    if (valido) {
      try {
        await navigator.share(datos);
        return 'compartido';
      } catch (error) {
        // El usuario cerró el menú: no es un error y no hay que copiar nada.
        if (error.name === 'AbortError') return 'cancelado';

        // NotAllowedError (sin gesto, política del sitio), DataError…: el menú
        // no está disponible ahora mismo, así que se usa el plan B.
        console.warn(`[compartir] navigator.share falló (${error.name}); se copia al portapapeles`);
      }
    } else {
      console.warn('[compartir] canShare() rechazó los datos; se copia al portapapeles');
    }
  }

  await copiarTexto(comoTexto(datos));
  return 'copiado';
}

/**
 * Copia texto al portapapeles.
 *
 * Primero la Clipboard API (asíncrona, solo en HTTPS o localhost). Si no existe
 * o el navegador la niega, el método antiguo: un <textarea> temporal fuera de
 * la pantalla y execCommand('copy'), que algunos navegadores aún aceptan dentro
 * de un clic.
 *
 * @param {string} texto
 * @throws {Error} si ninguno de los dos funcionó
 */
export async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch (error) {
      console.warn(`[compartir] clipboard.writeText falló (${error.name}); se prueba execCommand`);
    }
  }

  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();

  let copiado = false;
  try {
    copiado = document.execCommand('copy');
  } finally {
    area.remove();
  }

  if (!copiado) throw new Error('El navegador no dejó copiar al portapapeles.');
}
