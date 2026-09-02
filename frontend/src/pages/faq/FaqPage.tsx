import { Link } from "react-router-dom";
import { FaChevronDown, FaEnvelope, FaInstagram, FaLocationDot, FaClock } from "react-icons/fa6";
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
 */
const QUESTIONS: Question[] = [
  {
    q: "¿Dónde están?",
    a: (
      <p>
        En 9 de Julio 3672. Atendemos de lunes a viernes, de 8 a 20, aunque cada profesional tiene sus propios días y
        horarios y los vas a ver al pedir el turno.
      </p>
    ),
  },
  {
    q: "¿Qué disciplinas se atienden?",
    a: (
      <>
        <p>Cuatro.</p>
        <ul className="faq-list">
          <li>
            <strong>Psicopedagogía</strong> — aprendizaje, atención y acompañamiento escolar.
          </li>
          <li>
            <strong>Psicología</strong> — terapia individual para adolescentes y adultos.
          </li>
          <li>
            <strong>Nutrición</strong> — planes de alimentación y seguimiento.
          </li>
          <li>
            <strong>Fonoaudiología</strong> — voz, habla y deglución, en chicos y en grandes.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "¿Quién se hace cargo de mi tratamiento?",
    a: (
      <>
        <p>
          El profesional que te atiende. Cada uno es responsable de sus pacientes, de sus turnos y de todo lo que pasa en
          la consulta.
        </p>
        <p>
          Consultorios del Jardín pone el espacio, la agenda y esta aplicación. No dirige los tratamientos ni responde por
          ellos, así que cualquier cosa sobre tu atención se habla directamente con tu profesional.
        </p>
      </>
    ),
  },
  {
    q: "¿Cuánto cuesta una consulta?",
    a: (
      <p>
        Lo pactás con el profesional. Cada uno fija sus honorarios y cobra por su cuenta, y el consultorio no interviene en
        eso. Conviene preguntarlo al sacar el primer turno para no llevarte una sorpresa.
      </p>
    ),
  },
  {
    q: "¿Cómo saco un turno?",
    a: (
      <p>
        Creás tu cuenta, entrás a <Link to="/Appointment">Pedir un turno</Link> y elegís profesional y horario entre los que
        estén libres. El turno queda pendiente hasta que el profesional lo confirma, y te avisamos por mail cuando eso pasa.
      </p>
    ),
  },
  {
    q: "¿Y si no puedo ir?",
    a: (
      <p>
        Cancelalo desde <Link to="/AppointmentsList">Mis turnos</Link> apenas sepas. El horario vuelve a quedar libre para
        otra persona, y tu profesional se entera sin que tengas que escribirle.
      </p>
    ),
  },
  {
    q: "¿Puedo elegir con quién atenderme?",
    a: (
      <p>
        Sí. Al pedir turno ves a todos los profesionales con su especialidad y sus horarios, y cada uno tiene una
        presentación para que sepas con quién te vas a encontrar.
      </p>
    ),
  },
  {
    q: "¿Puedo ver lo que anota mi profesional?",
    a: (
      <p>
        Sí. Lo que escribe después de cada consulta lo vas a encontrar en{" "}
        <Link to="/AppointmentsList">Mis turnos</Link>, abriendo el turno. Ahí quedan las indicaciones, el plan que te haya
        armado y lo que tengas que mirar hasta la próxima vez.
      </p>
    ),
  },
  {
    q: "¿Qué pasa con mis datos?",
    a: (
      <p>
        Lo que cargás en tu perfil lo usamos para gestionar tus turnos y nada más. Lo que anota tu profesional lo ven él y
        vos, nadie más.
      </p>
    ),
  },
];

/**
 * Preguntas frecuentes.
 *
 * Se abre y se cierra cada una en vez de mostrarlas todas desplegadas porque el valor de
 * esta pantalla está en poder barrer las preguntas con la vista y encontrar la propia.
 * Nueve respuestas abiertas obligan a leerlas todas para descartarlas.
 */
export function FaqPage() {
  return (
    <div className="adm-page faq-page">
      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Preguntas frecuentes</h1>
          <p className="adm-subtitle">Lo que más nos preguntan antes de la primera consulta</p>
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
                Lunes a viernes, de 8 a 20
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
            <p>¿No está lo que buscabas?</p>
            <Link className="adm-btn adm-btn-primary" to="/contacto">
              Escribinos
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
