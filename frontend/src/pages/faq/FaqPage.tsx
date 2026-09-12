import { Link } from "react-router-dom";
import { FaChevronDown, FaEnvelope, FaInstagram, FaLocationDot, FaClock } from "react-icons/fa6";
import { SPECIALITIES } from "../specialities";
import "../adminCRUDS/adminPanel.css";
import "./faq.css";

const MAIL = "consultoriosjardinok@gmail.com";
const INSTAGRAM = "consultorios_jardin";

interface Question {
  q: string;
  a: React.ReactNode;
}

/**
 * Lo que se pregunta antes de sacar el primer turno.
 *
 * Están en el orden en que aparecen las dudas de alguien que todavía no vino, no
 * agrupadas por tema. Primero dónde queda y qué se atiende, después quién se hace cargo
 * y cuánto sale, y al final cómo funciona la aplicación.
 *
 * Las especialidades salen de la misma lista que usa el pedido de turno, sin
 * descripciones ni cantidad: el consultorio pidió no comprometerse con nada que cambie
 * cuando se sume o se vaya una.
 */
const QUESTIONS: Question[] = [
  {
    q: "¿Dónde queda el consultorio?",
    a: (
      <p>
        En 9 de Julio 3672, de lunes a viernes de 9 a 20. Cada profesional tiene sus propios días y horarios, visibles al
        solicitar el turno.
      </p>
    ),
  },
  {
    q: "¿Qué especialidades se atienden?",
    a: <p>{SPECIALITIES.join(", ")}.</p>,
  },
  {
    q: "¿Quién es responsable del tratamiento?",
    a: (
      <>
        <p>Cada profesional es responsable de sus pacientes, de sus turnos y de lo que ocurre en la consulta.</p>
        <p>
          Consultorios del Jardín provee el espacio, la agenda y esta aplicación, sin intervenir en los tratamientos. Las
          consultas sobre la atención se hablan con el profesional.
        </p>
      </>
    ),
  },
  {
    q: "¿Cuánto cuesta una consulta?",
    a: (
      <p>
        Los honorarios los fija cada profesional, que cobra en forma directa. Conviene consultarlos al solicitar el primer
        turno.
      </p>
    ),
  },
  {
    q: "¿Cómo se solicita un turno?",
    a: (
      <p>
        Con una cuenta creada, desde <Link to="/Appointment">Solicitar turno</Link>, eligiendo especialidad o profesional y
        un horario libre. El turno queda pendiente hasta la confirmación del profesional, con aviso por mail.
      </p>
    ),
  },
  {
    q: "¿Cómo se cancela un turno?",
    a: (
      <p>
        Desde <Link to="/AppointmentsList">Mis turnos</Link>, con la mayor anticipación posible. El horario queda libre y el
        profesional recibe el aviso.
      </p>
    ),
  },
  {
    q: "¿Se puede elegir profesional?",
    a: <p>Sí. Al solicitar turno figuran todos los profesionales, con su especialidad, sus horarios y una presentación.</p>,
  },
  {
    q: "¿Dónde se ven las indicaciones del profesional?",
    a: (
      <p>
        En <Link to="/AppointmentsList">Mis turnos</Link>, abriendo cada turno. Ahí quedan las indicaciones y el plan de
        trabajo.
      </p>
    ),
  },
  {
    q: "¿Qué uso tienen los datos personales?",
    a: (
      <p>
        Los datos del perfil se usan solo para gestionar los turnos. Las anotaciones de cada consulta las ven únicamente el
        profesional y el paciente.
      </p>
    ),
  },
];

/**
 * Preguntas frecuentes.
 *
 * Se abre y se cierra cada una en vez de mostrarlas todas desplegadas porque el valor de
 * esta pantalla está en poder barrer las preguntas con la vista y encontrar la propia.
 * Todas abiertas obligan a leerlas enteras para descartarlas.
 */
export function FaqPage() {
  return (
    <div className="adm-page faq-page">
      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Preguntas frecuentes</h1>
          <p className="adm-subtitle">Antes de la primera consulta</p>
        </div>
        <Link className="adm-back" to="/">
          Volver al inicio
        </Link>
      </header>

      <div className="faq-layout">
        <div className="faq-questions">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary className="faq-question">
                {item.q}
                <FaChevronDown className="faq-chevron" aria-hidden="true" />
              </summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </div>

        <aside className="faq-aside">
          <div className="adm-panel faq-card">
            <div className="adm-panel-head">El consultorio</div>
            <ul className="faq-facts">
              <li>
                <FaLocationDot aria-hidden="true" />
                9 de Julio 3672
              </li>
              <li>
                <FaClock aria-hidden="true" />
                Lunes a viernes, de 9 a 20
              </li>
              <li>
                <FaEnvelope aria-hidden="true" />
                <a href={`mailto:${MAIL}`}>{MAIL}</a>
              </li>
              <li>
                <FaInstagram aria-hidden="true" />
                <a href={`https://instagram.com/${INSTAGRAM}`} target="_blank" rel="noreferrer">
                  @{INSTAGRAM}
                </a>
              </li>
            </ul>
          </div>

          <div className="faq-help">
            <p>¿Otra consulta?</p>
            <Link className="adm-btn adm-btn-primary" to="/contacto">
              Contacto
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
