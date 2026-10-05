import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { fullAddress, hasBranches, type Installation } from "../../lib/installation";
import { applicationLabel, isBuiltinFaq, type BuiltinFaqKey } from "../../lib/contentLists";
import { branchHours, branchPlace } from "../adminCRUDS/adminOffices/branches.ts";
import { words } from "../../lib/vocabulary";

export interface Question {
  key: string;
  q: string;
  a: ReactNode;
}

/**
 * Las preguntas de siempre, con su texto armado con los datos del consultorio.
 *
 * Están en el orden en que aparecen las dudas de alguien que todavía no vino, no
 * agrupadas por tema. Primero dónde queda y qué se atiende, después quién se hace cargo
 * y cuánto sale, y al final cómo funciona la aplicación. Cada consultorio puede ocultarlas,
 * moverlas o reescribirlas (ver lib/contentLists); las que no toca siguen estas.
 *
 * Las especialidades salen de la misma lista que usa el pedido de turno, sin
 * descripciones ni cantidad: el consultorio pidió no comprometerse con nada que cambie
 * cuando se sume o se vaya una.
 */
export function builtinQuestions(installation: Installation): Record<BuiltinFaqKey, { q: string; a: ReactNode }> {
  const w = words(installation.vocabulary);
  const p = installation.policies;
  const instagram = installation.instagram.replace(/^@/, "");
  const application = applicationLabel(installation.contactReasons, w) ?? "Quiero trabajar acá";

  // Con varias sucursales, la pregunta es por todas y la respuesta las lista, cada una con
  // dónde queda y su horario.
  const donde = hasBranches(installation)
    ? {
        q: `¿Dónde quedan ${w.los("sucursal")}?`,
        a: (
          <>
            {/* El párrafo arriba y la lista abajo: el párrafo trae su margen y la lista no. */}
            <p>
              {installation.publicHours ? `${installation.publicHours}. ` : ""}
              {`Cada ${w.profesional} tiene sus propios días, horarios y ${w.sucursales}, visibles al solicitar ${w.el("turno")}.`}
            </p>
            <ul className="faq-list">
              {installation.branches.map((branch) => {
                const place = branchPlace(branch, installation);
                const hours = branchHours(branch);
                return (
                  <li key={branch.id}>
                    <strong>{branch.name}</strong>.{place ? ` ${place}.` : ""}
                    {hours ? ` De ${hours}.` : ""}
                  </li>
                );
              })}
            </ul>
          </>
        ),
      }
    : {
        q: `¿Dónde queda ${w.el("lugar")}?`,
        a: (
          <p>
            En {fullAddress(installation)}.{installation.publicHours ? ` ${installation.publicHours}.` : ""}
            {` Cada ${w.profesional} tiene sus propios días y horarios, visibles al solicitar ${w.el("turno")}.`}
          </p>
        ),
      };

  return {
    donde,
    especialidades: {
      q: `¿Qué ${w.especialidades} se atienden?`,
      a: <p>{installation.services.join(", ")}.</p>,
    },
    responsable: {
      q: "¿Quién es responsable del tratamiento?",
      a: (
        <>
          <p>{`Cada ${w.profesional} es responsable de sus ${w.pacientes}, de sus ${w.turnos} y de lo que ocurre en la consulta.`}</p>
          <p>
            {installation.name} provee el espacio, la agenda y esta aplicación, sin intervenir en los tratamientos. Las
            consultas sobre la atención se hablan con {w.el("profesional")}.
          </p>
        </>
      ),
    },
    costo: {
      q: "¿Cuánto cuesta una consulta?",
      a: (
        <p>
          {`Los honorarios los fija cada ${w.profesional}, que cobra en forma directa. Conviene consultarlos al solicitar ${w.o("turno") === "a" ? "la" : "el"} ${w.primer("turno")}.`}
        </p>
      ),
    },
    solicitar: {
      q: `¿Cómo se solicita ${w.un("turno")}?`,
      a: p.patientBooking ? (
        <p>
          Con una cuenta creada, desde <Link to="/Appointment">{`Solicitar ${w.turno}`}</Link>
          {`, eligiendo ${w.especialidad} o ${w.profesional} y un horario libre. `}
          {p.acceptMode === "always"
            ? `${w.El("turno")} queda confirmad${w.o("turno")} en el momento, con aviso por mail.`
            : `${w.El("turno")} queda pendiente hasta la confirmación ${w.del("profesional")}, con aviso por mail.`}
        </p>
      ) : (
        <p>
          {`Directamente ${w.al("lugar")}, con los datos de `}
          <Link to="/contacto">Contacto</Link>.
        </p>
      ),
    },
    cancelar: {
      q: `¿Cómo se cancela ${w.un("turno")}?`,
      a: p.patientCancel ? (
        <p>
          Desde <Link to="/AppointmentsList">{`Mis ${w.turnos}`}</Link>, con la mayor anticipación posible. El horario queda
          libre y {w.el("profesional")} recibe el aviso.
          {p.cancelNoticeHours > 0 ? ` Se puede hasta ${p.cancelNoticeHours} horas antes. Más cerca, avisando ${w.al("lugar")}.` : ""}
        </p>
      ) : (
        <p>
          {`Avisándole ${w.al("lugar")}, con la mayor anticipación posible, con los datos de `}
          <Link to="/contacto">Contacto</Link>.
        </p>
      ),
    },
    elegir: {
      q: `¿Se puede elegir ${w.profesional}?`,
      a: (
        <p>
          {`Sí. Al solicitar ${w.turno} figuran tod${w.os("profesional")} ${w.los("profesional")}, con su ${w.especialidad}, sus horarios y una presentación.`}
        </p>
      ),
    },
    indicaciones: {
      q: `¿Dónde se ven las indicaciones ${w.del("profesional")}?`,
      a: (
        <p>
          En <Link to="/AppointmentsList">{`Mis ${w.turnos}`}</Link>
          {`, abriendo cada ${w.turno}. Ahí quedan las indicaciones y el plan de trabajo.`}
        </p>
      ),
    },
    datos: {
      q: "¿Qué uso tienen los datos personales?",
      a: (
        <p>
          {`Los datos del perfil se usan solo para gestionar ${w.los("turno")}. Las anotaciones de cada consulta las ven únicamente ${w.el("profesional")} y ${w.el("paciente")}.`}
        </p>
      ),
    },
    // La única que no es de un paciente: va al final para no meterse entre las suyas.
    sumarse: {
      q: `¿Cómo sumarse ${w.al("lugar")} como ${w.profesional}?`,
      a: (
        <p>
          Desde <Link to="/contacto?motivo=profesional">Contacto</Link>, con el motivo «{application}» y el CV adjunto
          {instagram ? (
            <>
              , o por mensaje a{" "}
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer">
                @{instagram}
              </a>{" "}
              en Instagram
            </>
          ) : null}
          .
        </p>
      ),
    },
  };
}

/**
 * Una respuesta escrita en el panel: texto, sin formato. Un renglón en blanco separa
 * párrafos y un salto de línea suelto se respeta.
 */
export function textAnswer(text: string): ReactNode {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index}>
        {paragraph.split("\n").map((line, position, lines) => (
          <span key={position}>
            {line}
            {position < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    ));
}

/**
 * Las preguntas que se ven, en el orden del consultorio.
 *
 * "¿Cómo sumarse?" lleva al motivo de quien quiere trabajar ahí. Si ese motivo está oculto,
 * la respuesta de siempre manda a un formulario que no lo tiene, así que tampoco se ve,
 * salvo que el consultorio le haya escrito una respuesta propia.
 */
export function faqQuestions(installation: Installation): Question[] {
  const builtin = builtinQuestions(installation);
  const application = applicationLabel(installation.contactReasons, words(installation.vocabulary));

  return installation.faq
    .filter((entry) => !entry.hidden)
    .flatMap((entry) => {
      if (!isBuiltinFaq(entry.id)) return [{ key: entry.id, q: entry.question, a: textAnswer(entry.answer) }];
      if (entry.id === "sumarse" && !application && !entry.answer) return [];
      const base = builtin[entry.id];
      return [{ key: entry.id, q: entry.question || base.q, a: entry.answer ? textAnswer(entry.answer) : base.a }];
    });
}
