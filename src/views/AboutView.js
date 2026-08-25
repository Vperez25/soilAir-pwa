/**
 * views/AboutView.js
 * -----------------------------------------------------------------------------
 * Ruta estática secundaria "/acerca".
 */

import { rutaCompleta } from '../router/router.js';

export function AboutView() {
  return `
    <article class="prosa">
      <p class="prosa__eyebrow">Acerca del proyecto</p>
      <h1>SoilAir</h1>

      <p>
        SoilAir es un sistema de monitoreo de suelo y aire para agricultura de
        precisión. En campo se instalan nodos con sensores de temperatura, pH,
        humedad, conductividad eléctrica y NPK; cada nodo levanta su propia red
        WiFi y la app móvil se conecta a él para descargar las lecturas, incluso
        sin internet en la parcela.
      </p>

      <p>
        Las lecturas por sí solas no dicen mucho. Lo que las vuelve útiles es
        compararlas contra el cultivo sembrado: 6.4 de pH es correcto para
        jitomate y demasiado alto para fresa. Por eso la app guarda un catálogo
        de cultivos con rangos ideales y críticos, y pinta cada sensor de verde,
        naranja o rojo según dónde caiga la medición.
      </p>

      <h2>Qué es esta versión web</h2>

      <p>
        Esta SPA reproduce esa parte del sistema en el navegador: el catálogo de
        cultivos y la ficha de cada uno con su última lectura. Está hecha con
        módulos ES6 y sin frameworks. El ruteo es propio y se apoya en la
        History API, así que Atrás y Adelante del navegador funcionan como en
        cualquier sitio.
      </p>

      <p>
        La ficha técnica vive en un módulo aparte que se carga con
        <code>import()</code> dinámico: mientras estás en el listado no se
        descarga, y baja apenas abres el primer cultivo.
      </p>

      <p>
        <a href="${rutaCompleta('/')}" data-link>Volver al catálogo</a>
      </p>
    </article>
  `;
}
