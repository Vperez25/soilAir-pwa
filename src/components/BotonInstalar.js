import {
  alCambiarInstalacion,
  esIOS,
  estaInstalada,
  pedirInstalacion,
  puedeInstalar,
} from "../pwa/instalacion.js";

export function montarBotonInstalar() {
  const boton = document.getElementById("boton-instalar");
  const ayuda = document.getElementById("ayuda-instalar");
  if (!boton || !ayuda) return;

  let pasoElTiempo = false; // espera corta antes de dar por perdido el evento

  function render() {
    // Botón: solo con evento guardado y la app fuera del modo instalado.
    boton.hidden = !puedeInstalar();

    // Plan B: nunca se bloquea nada, solo se informa.
    if (estaInstalada() || puedeInstalar()) {
      ayuda.hidden = true;
      return;
    }

    if (esIOS()) {
      ayuda.textContent =
        "Para instalar SoilAir en iPhone o iPad, toca Compartir y elige «Agregar a pantalla de inicio».";
      ayuda.hidden = false;
    } else if (pasoElTiempo) {
      ayuda.textContent =
        "Tu navegador no ofrece instalación desde aquí. Puedes buscar la opción «Instalar» en su menú; la app funciona igual desde la pestaña.";
      ayuda.hidden = false;
    }
  }

  boton.addEventListener("click", async () => {
    const eleccion = await pedirInstalacion();
    console.log("[instalacion] el usuario eligió:", eleccion);
  });

  alCambiarInstalacion(render);

  // En Chromium el evento puede tardar un poco; el mensaje genérico espera 3 s.
  setTimeout(() => {
    pasoElTiempo = true;
    render();
  }, 3000);

  render();
}
