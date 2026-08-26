/**
 * services/cultivosIndex.js
 * -----------------------------------------------------------------------------
 * Índice LIGERO de cultivos: solo lo que necesita la lista del inicio.
 *
 * Está separado de cultivosService.js a propósito: así el listado se pinta sin
 * descargar la ficha técnica completa, y en la pestaña Network se ve que
 * cultivosService.js baja únicamente cuando se entra al detalle de un cultivo.
 *
 * Datos tomados del catálogo real de la app móvil SoilAir (assets/plants/).
 */

/** @type {Array<{nombre:string, cientifico:string, familia:string, cicloDias:number, resumen:string}>} */
export const CULTIVOS = [
  {
    nombre: 'Jitomate',
    cientifico: 'Solanum lycopersicum',
    familia: 'Solanáceas',
    cicloDias: 110,
    resumen: 'Exigente en potasio y muy sensible a los golpes de calor durante la floración.',
  },
  {
    nombre: 'Maíz',
    cientifico: 'Zea mays',
    familia: 'Poáceas',
    cicloDias: 140,
    resumen: 'Necesita suelo tibio para germinar; el nitrógeno marca el rendimiento.',
  },
  {
    nombre: 'Lechuga',
    cientifico: 'Lactuca sativa',
    familia: 'Asteráceas',
    cicloDias: 60,
    resumen: 'Ciclo corto y raíz superficial: tolera poco la salinidad y el calor.',
  },
  {
    nombre: 'Fresa',
    cientifico: 'Fragaria × ananassa',
    familia: 'Rosáceas',
    cicloDias: 90,
    resumen: 'Prefiere suelo ácido y drenado; el exceso de humedad favorece hongos.',
  },
  {
    nombre: 'Chile Manzano',
    cientifico: 'Capsicum pubescens',
    familia: 'Solanáceas',
    cicloDias: 150,
    resumen: 'Muy demandante de potasio y de las pocas especies que aguanta clima fresco.',
  },
  {
    nombre: 'Trigo',
    cientifico: 'Triticum aestivum',
    familia: 'Poáceas',
    cicloDias: 130,
    resumen: 'Cultivo de invierno con alta demanda de radiación en el llenado de grano.',
  },
];
