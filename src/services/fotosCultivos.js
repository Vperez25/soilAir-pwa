/**
 * services/fotosCultivos.js
 * -----------------------------------------------------------------------------
 * Fotos de los cultivos: texto alternativo y crédito de cada una.
 *
 * Son de Wikimedia Commons con licencias Creative Commons que piden dar
 * crédito (y algunas, compartir igual). El crédito se muestra en /acerca.
 *
 * Los archivos están en images/cultivos/<id>-<ancho>.<formato>, recortados a
 * 3:2 y sin metadatos:
 *
 *   AVIF  480, 720, 1200 px   el más ligero; lo usa casi todo navegador actual
 *   WebP  480, 720, 1200 px   respaldo para los que no tienen AVIF
 *   JPEG  720 px              último respaldo (<img src>)
 */

/** Anchos generados de cada foto (los mismos para AVIF y WebP). */
export const ANCHOS = [480, 720, 1200];

/** Tamaño intrínseco de la variante más grande: fija la proporción 3:2. */
export const ANCHO_BASE = 1200;
export const ALTO_BASE = 800;

/** id del cultivo (slug, igual que en la URL) -> datos de su foto. */
export const FOTOS = {
  jitomate: {
    alt: 'Jitomates rojos maduros en la planta',
    autor: 'Steffen Bauer (www.saatpilot.de)',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/4.0',
    fuente: "https://commons.wikimedia.org/wiki/File:Solanum_lycopersicum_%27Brandywine_Red%27_(tomato),_ripe_fruits_on_the_plant_(SaatPilot).jpg",
  },
  maiz: {
    alt: 'Plantas de maíz con espiga en una parcela',
    autor: 'inkknife_2000',
    licencia: 'CC BY-SA 2.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Tasseled_Out,_Corn_Crop,_NW_Iowa_7-25-13f_(11033879664).jpg',
  },
  lechuga: {
    alt: 'Lechugas sembradas en hilera sobre tierra suelta',
    autor: '4028mdk09',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Lactuca_sativa_Kurpfalzhof_Oktober_2011.JPG',
  },
  fresa: {
    alt: 'Planta de fresa con frutos rojos y verdes sobre paja',
    autor: 'Kolforn',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:-2020-06-06_Strawberry_plant_with_fruit,_(Fragaria_%C3%97_ananassa),_Trimingham.JPG',
  },
  'chile-manzano': {
    alt: 'Chiles manzano rojos, enteros y partidos, sobre una mesa de madera',
    autor: 'Falcodigiada',
    licencia: 'CC BY-SA 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Capsicum_pubescens_(Rocoto).JPG',
  },
  trigo: {
    alt: 'Espigas de trigo verdes en el campo',
    autor: 'David Monniaux',
    licencia: 'CC BY-SA 3.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    fuente: 'https://commons.wikimedia.org/wiki/File:Wheat_P1210892.jpg',
  },
};
