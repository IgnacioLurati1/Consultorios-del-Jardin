import { Fragment, useState } from "react";
import { FaPlus } from "react-icons/fa6";
import { readCookie, writeCookie } from "../../lib/cookies.ts";
import { TECLA_ALT, TECLA_MOD } from "../../lib/shortcuts.ts";
import { useSimpleText } from "../../lib/textMode.ts";
import "./shortcuts.css";

const COOKIE = "atajos-abiertos";

interface Atajo {
  teclas: string[];
  /** Otra combinación que hace lo mismo. */
  tambien?: string[];
  titulo: string;
  descripcion: string;
  /**
   * La consecuencia: qué le pasa al paciente, o hasta dónde llega el atajo.
   *
   * Se lee siempre, aunque esté puesto el modo con menos texto. No es lugar para explicar
   * por qué el atajo es la tecla que es: eso resuelve una duda nuestra, no una de quien
   * está trabajando.
   */
  nota?: string;
  /** Necesita un turno marcado: se hace click en uno y recién ahí la tecla hace algo. */
  sobreTurno?: boolean;
}

const atajos: Atajo[] = [
  {
    teclas: [TECLA_ALT, "T"],
    titulo: "Nuevo turno",
    descripcion: "Abre la ventana para cargar un turno, estés en la pantalla que estés.",
  },
  {
    teclas: [TECLA_ALT, "P"],
    titulo: "Nuevo paciente",
    descripcion: "Abre la ventana para cargar un paciente, estés en la pantalla que estés.",
  },
  {
    teclas: [TECLA_MOD, "Z"],
    titulo: "Deshacer",
    descripcion: "Vuelve atrás lo último que hiciste, y te avisa cómo quedó.",
    nota: "Vale mientras sigas en la misma pantalla. Si te fuiste, el cambio ya es definitivo. Cancelar un turno no se deshace nunca.",
  },
  {
    teclas: ["Click derecho"],
    titulo: "Cambiar el estado",
    descripcion: "Pendiente pasa a Confirmado, Confirmado a Asistió, Asistió a No vino, y desde ahí van y vienen.",
    nota: "Confirmar le manda el mail al paciente. Deshacerlo devuelve el turno a Pendiente, pero el mail ya salió.",
    sobreTurno: true,
  },
  {
    teclas: ["Retroceso"],
    tambien: ["Supr"],
    titulo: "Cancelar el turno",
    descripcion: "Lo cancela, salvo que ya figure como asistido.",
    nota: "Pregunta antes de hacerlo, y al paciente le llega un mail avisándole.",
    sobreTurno: true,
  },
];

function Teclas({ teclas }: { teclas: string[] }) {
  return (
    <span className="atajo-teclas">
      {teclas.map((tecla, indice) => (
        <Fragment key={tecla}>
          {indice > 0 && <span className="atajo-mas">+</span>}
          <kbd className="atajo-tecla">{tecla}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * El cartel que explica los atajos, abajo de todo en el panel del profesional.
 *
 * Va al final y plegable porque se lee una vez: el que ya los sabe no necesita verlos
 * todos los días, y el que no los sabe no los va a descubrir solo. Por eso arranca
 * abierto la primera vez y después respeta lo que la persona haya dejado —cerrarlo es
 * decir "ya está, los aprendí", y eso tiene que durar.
 */
export function ShortcutsPanel() {
  const [simple] = useSimpleText();
  const [abierto, setAbierto] = useState(() => readCookie(COOKIE) !== "0");

  function alternar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    try {
      writeCookie(COOKIE, siguiente ? "1" : "0");
    } catch {
      // Sin poder recordarlo la próxima vez se abre de nuevo, que no es grave.
    }
  }

  return (
    <section className="atajos">
      <button
        type="button"
        className={`adm-section-toggle ${abierto ? "open" : ""}`}
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls="atajos-lista"
      >
        <span className="adm-plus">
          <FaPlus />
        </span>
        {abierto ? "Ocultar los atajos del teclado" : "Atajos del teclado"}
      </button>

      <div id="atajos-lista" className={`adm-collapsible ${abierto ? "open" : ""}`}>
        <div>
          <div className="adm-collapsible-inner">
            <div className="adm-panel" inert={!abierto}>
              <ul className="atajos-lista">
                {atajos.map((atajo) => (
                  <li className="atajo" key={atajo.titulo}>
                    <span className="atajo-combo">
                      <Teclas teclas={atajo.teclas} />
                      {/* El "o" va adentro del mismo bloque que la alternativa: cuando las
                          dos combinaciones no entran en un renglón, la segunda baja con su
                          "o" adelante en vez de dejarlo colgado al final de la primera. */}
                      {atajo.tambien && (
                        <span className="atajo-alternativa">
                          <span className="atajo-o">o</span>
                          <Teclas teclas={atajo.tambien} />
                        </span>
                      )}
                    </span>

                    <span className="atajo-texto">
                      <span className="atajo-titulo">
                        {atajo.titulo}
                        {atajo.sobreTurno && <span className="atajo-donde">sobre un turno</span>}
                      </span>
                      {!simple && <span className="atajo-desc">{atajo.descripcion}</span>}
                      {atajo.nota && <span className="atajo-nota">{atajo.nota}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
