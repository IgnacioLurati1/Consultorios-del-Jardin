import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaCheck, FaLeaf } from "react-icons/fa6";
import type { Session } from "../Home";

interface HeroProps {
  session: Session;
}

interface Pitch {
  eyebrow: string;
  title: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
}

/**
 * Lo que la portada le dice a cada uno. El paciente que llega de afuera necesita
 * entender qué es esto; el que ya tiene cuenta necesita el camino corto a lo suyo,
 * y no que le vuelvan a explicar el consultorio.
 */
function pitchFor({ type, firstName }: Session): Pitch {
  const hello = firstName ? `Hola, ${firstName}` : "Hola de nuevo";

  switch (type) {
    case "client":
      return {
        eyebrow: hello,
        title: "Tu próximo turno empieza acá.",
        lead: "Elegí profesional, mirá los horarios que quedan libres y confirmá. Te llega el recordatorio por mail.",
        primary: { label: "Pedir un turno", to: "/Appointment" },
        secondary: { label: "Ver mis turnos", to: "/AppointmentsList" },
      };
    case "professional":
      return {
        eyebrow: hello,
        title: "Tu día, ordenado antes de empezar.",
        lead: "Los turnos de hoy, tu agenda semanal, tus pacientes y los números del mes, en un solo lugar.",
        primary: { label: "Ir a mi panel", to: "/ProfessionalHome" },
        secondary: { label: "Ver mis turnos", to: "/AppointmentsList" },
      };
    case "admin":
      return {
        eyebrow: hello,
        title: "El consultorio, de un vistazo.",
        lead: "Horarios y consultorios, altas de usuarios, control de turnos y los números de cada profesional.",
        primary: { label: "Panel de administración", to: "/AdminHome" },
        secondary: { label: "Números del consultorio", to: "/AdminHome/Analytics" },
      };
    default:
      return {
        eyebrow: "Consultorios del Jardín",
        title: "Sacá turno con el profesional que quieras.",
        lead: "Cuatro especialidades en un mismo lugar. Elegís con qué profesional te atendés, ves los horarios que tiene libres y confirmás desde el celular, sin llamar por teléfono.",
        primary: { label: "Crear mi cuenta", to: "/Register" },
        secondary: { label: "Ya tengo cuenta", to: "/Login" },
      };
  }
}

const FACTS = ["4 especialidades", "Elegís tu profesional", "Recordatorio por mail"];

export function Hero({ session }: HeroProps) {
  const pitch = pitchFor(session);

  // A dónde lleva la muestra de agenda. Con sesión, derecho a pedir un turno; sin ella,
  // a crear la cuenta, que es lo que hace falta antes y es lo mismo que ofrece el botón
  // principal. Mandar a alguien sin cuenta directo a la pantalla de turnos lo deja en el
  // login sin haber entendido por qué.
  const booking =
    session.type === "guest"
      ? { to: "/Register", label: "Crear mi cuenta para pedir un turno" }
      : { to: "/Appointment", label: "Pedir un turno" };

  return (
    <section className="home-hero">
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-eyebrow">
            <FaLeaf aria-hidden="true" />
            {pitch.eyebrow}
          </p>

          <h1 className="home-title">{pitch.title}</h1>
          <p className="home-lead">{pitch.lead}</p>

          <div className="home-actions">
            <Link className="home-btn home-btn-primary" to={pitch.primary.to}>
              {pitch.primary.label}
              <FaArrowRight aria-hidden="true" />
            </Link>
            <Link className="home-btn home-btn-ghost" to={pitch.secondary.to}>
              {pitch.secondary.label}
            </Link>
          </div>

          <ul className="home-facts">
            {FACTS.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>

        <AgendaPreview to={booking.to} label={booking.label} />
      </div>
    </section>
  );
}

interface Slot {
  hour: string;
  taken: boolean;
}

/** Horarios de muestra. Arrancan a las 9, que es cuando abre el consultorio. */
const SLOTS: Slot[] = [
  { hour: "09:00", taken: true },
  { hour: "10:00", taken: false },
  { hour: "11:00", taken: true },
  { hour: "12:00", taken: false },
  { hour: "15:00", taken: false },
];

/** La franja que se "reserva" sola al final de la animación. */
const PICKED = 3;

/** El próximo día hábil: la muestra no puede quedar fechada en un lunes de otro año. */
function nextWeekday(): string {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);

  return day.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * La pieza central de la portada: en vez de una foto, la agenda misma escribiéndose
 * franja por franja hasta que una queda tomada. Es lo único que hace la aplicación y
 * se entiende sin leer una palabra.
 *
 * No son datos reales: es una muestra fija con la fecha del próximo día hábil.
 */
function AgendaPreview({ to, label }: { to: string; label: string }) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [booked, setBooked] = useState(!!reduced);

  useEffect(() => {
    if (reduced) return;

    // Después de que entró la última franja: primero se lee la agenda, después se ve
    // que una se ocupa.
    const timer = window.setTimeout(() => setBooked(true), 400 + SLOTS.length * 130 + 700);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <div className={`home-agenda ${reduced ? "is-static" : ""}`}>
      {/* La muestra es un dibujo, pero lleva al lugar que dibuja. Lo de adentro sigue
          escondido para el lector de pantalla —es una agenda inventada, no la de
          nadie— y lo único que se anuncia es a dónde lleva. */}
      <Link className="home-agenda-card" to={to} aria-label={label}>
        <header className="home-agenda-head" aria-hidden="true">
          <div>
            <span className="home-agenda-day">{nextWeekday()}</span>
            {/* Sin nombre propio: es una muestra y no tiene que confundirse con la
                agenda real de nadie. */}
            <span className="home-agenda-who">Psicología · Consultorio 2</span>
          </div>
          <span className="home-agenda-tag">Ejemplo</span>
        </header>

        <ul className="home-agenda-list" aria-hidden="true">
          {SLOTS.map((slot, index) => {
            const mine = booked && index === PICKED;
            const free = !slot.taken && !mine;

            return (
              <li
                key={slot.hour}
                className={`home-slot ${slot.taken ? "is-taken" : ""} ${mine ? "is-mine" : ""}`}
                style={{ animationDelay: `${400 + index * 130}ms` }}
              >
                <span className="home-slot-hour">{slot.hour}</span>
                <span className="home-slot-state">
                  {slot.taken && "Ocupado"}
                  {free && "Libre"}
                  {mine && (
                    <>
                      <FaCheck /> Tu turno
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Link>

      <p className="home-agenda-caption">Así se eligen los horarios. Los libres se ven, se tocan y quedan tomados.</p>
    </div>
  );
}
