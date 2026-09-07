import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../../context/AuthContext.tsx";
import { useUndo } from "../../context/UndoContext.tsx";
import { conModificador, escribiendo, esLetra } from "../../lib/shortcuts.ts";
import type { TokenPayload } from "../../pages/types.ts";

/**
 * Los atajos que valen en toda la web, escuchados desde un solo lugar.
 *
 * No dibuja nada: vive colgado del layout para que las teclas funcionen estés en la
 * pantalla que estés. Lo que hacen los dos primeros es llevarte a donde se hace la cosa
 * con la ventana ya abierta, y eso se pide por la dirección (`?nuevo=1`) en vez de por un
 * contexto con un `abrirTurno()` adentro: la pantalla destino todavía no está montada
 * cuando se aprieta la tecla, así que no hay a quién avisarle. La dirección sí sobrevive
 * al viaje, y de paso el mismo link se puede pegar en cualquier lado.
 *
 * Son solo para el profesional. El paciente no da de alta turnos ajenos ni pacientes, y
 * el admin no atiende: robarles combinaciones del navegador para nada sería peor que no
 * tener atajos.
 */
export function ShortcutListener() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { undoLast } = useUndo();

  // Del token del contexto y no del que está guardado en el navegador: así entrar o salir
  // prende y apaga los atajos en el momento, sin recargar la página.
  const tipo = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode<TokenPayload>(token).type;
    } catch {
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (tipo !== "professional") return;

    function onKeyDown(event: KeyboardEvent) {
      // Escribiendo no se interrumpe a nadie. Ctrl+Z adentro de un campo es el deshacer
      // del navegador, que para el texto funciona mejor que cualquier cosa nuestra.
      if (escribiendo(event.target)) return;

      const modificador = conModificador(event);

      /*
       * Las dos que abren una ventana van con Alt, no con Ctrl.
       *
       * Ctrl+T y ⌘+T son del navegador: abren una pestaña y la tecla nunca llega hasta acá,
       * así que no hay forma de quedársela desde una página. Ctrl+P (imprimir) sí se puede
       * interceptar, pero entonces una de las dos se apretaría con Ctrl y la otra con Alt,
       * y un atajo que hay que recordar de a una tecla modificadora por vez no lo usa
       * nadie. Las dos con Alt: la misma regla para las dos, y funciona siempre.
       */
      const alterna = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

      if (alterna && esLetra(event, "t")) {
        event.preventDefault();
        navigate("/AppointmentsList?nuevo=1");
        return;
      }

      if (alterna && esLetra(event, "p")) {
        event.preventDefault();
        navigate("/Patients?nuevo=1");
        return;
      }

      // Deshacer sí va con la modificadora de siempre: Ctrl+Z (o ⌘+Z) llega hasta acá sin
      // problema, y es el deshacer que todo el mundo ya tiene en los dedos.
      if (modificador && esLetra(event, "z")) {
        event.preventDefault();
        undoLast();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tipo, navigate, undoLast]);

  return null;
}
