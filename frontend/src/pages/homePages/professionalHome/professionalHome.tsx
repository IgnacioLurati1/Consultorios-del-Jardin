import { FaCalendarAlt, FaClipboardList, FaUserInjured } from "react-icons/fa";
import {
  FaArrowRight,
  FaChartColumn,
  FaCheck,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaMoneyBillWave,
  FaRegClock,
} from "react-icons/fa6";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { findPerson, getDecodedToken } from "../../commonServices";
import {
  findPendingAppointments,
  findProfessionalAppointmentsInRange,
  findUnpaidAppointments,
} from "../../appointments/appointmentsService.ts";
import { useAppointmentActions } from "../../appointments/useAppointmentActions.ts";
import { AppointmentDetailModal } from "../../appointments/appointmentsList/AppointmentDetailModal.tsx";
import { CancelAppointmentModal } from "../../appointments/CancelAppointmentModal.tsx";
import {
  appointmentDate,
  cancellationNotice,
  describePayment,
  describeState,
  formatDayLabel,
  isCancelled,
  pendingAmount,
  shortHour,
  stateTone,
  toISODate,
} from "../../appointments/appointmentTypes.ts";
import type { Appointment, Person } from "../../types";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { ProfessionalSettings } from "./ProfessionalSettings.tsx";
import { Modal } from "../../../components/modal/Modal.tsx";
import { acceptPendingAppointments, settleUnpaidAppointments } from "./settingsService.ts";
import { AnnouncementBanner } from "../../announcements/AnnouncementBanner.tsx";
import { ShortcutsPanel } from "../../../components/shortcuts/ShortcutsPanel.tsx";
import { WaitlistPeopleModal } from "../../appointments/waitlist/WaitlistPeopleModal.tsx";
import { findMyWaitlist, type WaitingPatient } from "../../appointments/waitlist/waitlistService.ts";
import { describeDaysTitle } from "../../appointments/waitlist/waitlistRules.ts";
import "../../adminCRUDS/adminPanel.css";
import { useSimpleText } from "../../../lib/textMode";
import { useSimpleView } from "../../../lib/simpleView";
import "./professionalHome.css";

interface MenuEntry {
  icon: React.ComponentType;
  title: string;
  description: string;
  link: string;
}

const entries: MenuEntry[] = [
  {
    icon: FaClipboardList,
    title: "Turnos",
    description: "Agenda de turnos en grilla o en lista, con su estado y su paciente.",
    link: "/AppointmentsList",
  },
  {
    icon: FaCalendarAlt,
    title: "Horarios",
    description: "Agenda semanal y duración de los turnos de cada módulo.",
    link: "/scheduleProfessional",
  },
  {
    icon: FaUserInjured,
    title: "Pacientes",
    description: "Pacientes con cuenta y pacientes anónimos.",
    link: "/Patients",
  },
  {
    icon: FaChartColumn,
    title: "Números",
    description: "Facturación, pacientes y carga de la agenda, mes a mes.",
    link: "/Analytics",
  },
];

export function ProfessionalHome() {
  const [simple] = useSimpleText();
  const [simpleView] = useSimpleView();
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<Appointment[] | null>(null);
  const [pending, setPending] = useState<Appointment[] | null>(null);
  const [pendingPage, setPendingPage] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [confirmingSettle, setConfirmingSettle] = useState(false);
  /** Lo que hay sin cobrar en total, que puede ser más de lo que trae la lista. */
  const [unpaidTotal, setUnpaidTotal] = useState({ appointments: 0, amount: 0 });
  const [unpaid, setUnpaid] = useState<Appointment[] | null>(null);
  // Arranca cerrada. Es una cuenta pendiente, no algo que haya que hacer hoy: se abre
  // cuando uno viene a reclamar, y mientras tanto alcanza con el número del renglón.
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  /** Quiénes esperan que se libere un horario suyo. */
  const [waitlist, setWaitlist] = useState<WaitingPatient[] | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    findPerson(decoded.email)
      .then((data) => {
        if (!data) {
          toast.error("No se encontró el profesional");
          return;
        }
        setProfessional(data);
      })
      .catch((err) => toast.error(`Error al cargar los datos: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  /*
   * La agenda del día: el rango de un solo día.
   *
   * Se piden también los cancelados, pero de esos queda uno solo: el que el paciente dio
   * de baja con menos de un día de aviso. El resto se liberó con tiempo y probablemente ya
   * lo tomó otro, así que no explica ningún hueco de hoy. Este sí, y si no aparece acá no
   * hay dónde enterarse: el horario queda vacío y nadie sabe por qué.
   */
  function loadToday() {
    const iso = toISODate(new Date());

    findProfessionalAppointmentsInRange(iso, iso, true)
      .then((data) =>
        setToday(
          data
            .filter((appointment) => !isCancelled(appointment.state) || cancellationNotice(appointment)?.short)
            .sort((a, b) => a.initialHour.localeCompare(b.initialHour))
        )
      )
      .catch(() => setToday([]));
  }

  useEffect(loadToday, []);

  // Los pedidos que esperan respuesta. Se recargan junto con la agenda porque aceptar o
  // rechazar uno cambia las dos listas a la vez.
  function loadPending() {
    findPendingAppointments()
      .then(setPending)
      .catch(() => setPending([]));
  }

  useEffect(loadPending, []);

  // Lo que ya se atendió y todavía no se cobró. Va junto con lo demás porque cobrar un
  // turno desde su ficha lo saca de esta lista.
  function loadUnpaid() {
    findUnpaidAppointments()
      .then(({ appointments, total }) => {
        setUnpaid(appointments);
        setUnpaidTotal(total);
      })
      .catch(() => {
        setUnpaid([]);
        setUnpaidTotal({ appointments: 0, amount: 0 });
      });
  }

  useEffect(loadUnpaid, []);

  // Contra un servidor de antes no hay lista, y eso es lo mismo que una lista vacía: la
  // caja no se dibuja.
  useEffect(() => {
    findMyWaitlist()
      .then(setWaitlist)
      .catch(() => setWaitlist([]));
  }, []);

  function refresh() {
    loadToday();
    loadPending();
    loadUnpaid();
  }

  /**
   * Confirma de una todos los pedidos que están esperando.
   *
   * No tiene nada que ver con la confirmación automática, que vale para lo que entre de
   * acá en adelante: esto se lleva puesto lo que ya está en la lista, y por eso el botón
   * vive acá arriba y no en la configuración.
   */
  function acceptAll() {
    setAccepting(true);
    acceptPendingAppointments()
      .then((accepted) => {
        toast.success(accepted === 1 ? "Confirmaste el turno" : `Confirmaste ${accepted} turnos`);
        refresh();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setAccepting(false));
  }

  /**
   * Da por cobrado todo lo que quedó sin saldar.
   *
   * El gemelo de confirmar los pedidos de una, del otro lado del mostrador: el que cobra en
   * efectivo y no anota turno por turno junta una lista larga que no describe nada, y
   * saldarla de a uno son cuarenta clicks.
   */
  function settleAll() {
    setConfirmingSettle(false);
    setSettling(true);
    settleUnpaidAppointments()
      .then(({ settled, amount }) => {
        toast.success(
          settled === 1
            ? `Turno dado por cobrado${amount > 0 ? `, $${amount}` : ""}`
            : `${settled} turnos dados por cobrados${amount > 0 ? `, $${amount}` : ""}`
        );
        refresh();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSettling(false));
  }

  // Tocar un turno de hoy abre la misma ficha que en la lista de turnos: se acepta, se
  // cancela, se carga el registro y se repite igual que allá.
  const { open, detailProps, quickActions, cancelProps } = useAppointmentActions(professional, refresh);

  const dayLabel = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  // De a cinco. Más que eso deja de ser un aviso arriba del panel y pasa a ser la
  // pantalla de turnos, que ya existe y está a un click.
  const PER_PAGE = 5;
  const pendingCount = pending?.length ?? 0;
  const pendingPages = Math.ceil(pendingCount / PER_PAGE);
  const page = Math.min(pendingPage, Math.max(0, pendingPages - 1));
  const pendingSlice = pending?.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE) ?? [];

  /*
   * Lo que falta cobrar, sumado. Es el número que hace que valga la pena abrir la lista.
   *
   * Sale del total que manda el servidor y no de sumar la lista: la lista tiene tope, y el
   * que trajo dos años de agenda puede tener más turnos sin cobrar de los que entran acá.
   * Con el botón de saldar todo al lado, ese número dejó de ser informativo y pasó a ser el
   * que alguien mira para decidir.
   */
  const unpaidCount = unpaidTotal.appointments;
  const owed = unpaidTotal.amount;
  const unpaidShown = unpaid?.length ?? 0;

  return (
    <div className="adm-page">
      {/* Arriba de todo, antes del saludo: si el consultorio tiene algo que decir, se
          lee antes de ponerse a trabajar y no después de haber hecho las cosas mal. */}
      <AnnouncementBanner />

      <header className="adm-header">
        <div className="adm-header-titles">
          {loading ? (
            <>
              <SkeletonLine width="320px" height={28} />
              <SkeletonLine width="180px" height={16} />
            </>
          ) : (
            <>
              <h1 className="adm-title">
                Hola, {professional?.name} {professional?.surname}
              </h1>
              <p className="adm-subtitle">{professional?.speciality || "Panel del profesional"}</p>
            </>
          )}
        </div>
      </header>

      {/* Las cuatro se quedan siempre, también en la vista simplificada: son las puertas
          a todo lo demás, y esconder una sería esconder una pantalla entera. */}
      <section className="adm-card-grid">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link className="adm-card" to={entry.link} key={entry.title}>
              <span className="adm-card-icon">
                <Icon />
              </span>
              <span className="adm-card-title">{entry.title}</span>
              {/* El título de la tarjeta ya dice a dónde lleva; esto lo desarrolla. */}
              {!simple && <span className="adm-card-desc">{entry.description}</span>}
            </Link>
          );
        })}
      </section>

      {/*
        Los tres bloques que siguen no se dibujan con la vista simplificada.
        ------------------------------------------------------------------
        Son la agenda del día, los pedidos que esperan respuesta y lo que quedó sin cobrar.
        Ninguno se pierde: los tres se miran enteros desde la pantalla de turnos, que está
        en la primera tarjeta de arriba. Lo que se gana es un panel que entra en la
        pantalla de una, en vez de tres listas una abajo de la otra.
      */}
      {!simpleView && (
      <section className="prof-today">
        <div className="prof-today-head">
          <div>
            <h2 className="prof-today-title">Hoy</h2>
            <p className="prof-today-date">{dayLabel}</p>
          </div>
          <Link className="adm-btn adm-btn-ghost" to="/AppointmentsList">
            Ver toda la agenda
            <FaArrowRight />
          </Link>
        </div>

        <div className="adm-panel">
          {today === null ? (
            <div className="prof-today-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="70%" height={18} />
              <SkeletonLine width="45%" height={18} />
            </div>
          ) : today.length === 0 ? (
            <div className="adm-empty">Sin turnos para hoy.</div>
          ) : (
            <ul className="prof-today-list">
              {today.map((appointment) => {
                // La baja sobre la hora se nombra por lo que es. "Cancelado" a secas la
                // deja igual que una que avisó con una semana, que es lo contrario de lo
                // que hay que ver acá.
                const late = isCancelled(appointment.state) && cancellationNotice(appointment)?.short;
                const state = late
                  ? { label: "Dio de baja sobre la hora", className: "adm-badge adm-badge-red" }
                  : describeState(appointment.state);

                return (
                  <li key={appointment.numAppointment}>
                    <button
                      type="button"
                      className={`prof-today-item tone-${late ? "red" : stateTone(appointment.state)}${
                        late ? " cancelled-late" : ""
                      }`}
                      onClick={() => open(appointment)}
                      {...quickActions(appointment)}
                    >
                      <span className="prof-today-hour">
                        <FaRegClock aria-hidden="true" />
                        {shortHour(appointment.initialHour)}
                      </span>
                      <span className="prof-today-person">
                        {appointment.patient ? (
                          `${appointment.patient.surname}, ${appointment.patient.name}`
                        ) : (
                          <span className="prof-today-free">Sin paciente asignado</span>
                        )}
                      </span>
                      <span className="prof-today-room">{appointment.room?.description}</span>
                      {appointment.overbooked && <span className="appt-tag-over">Turno especial</span>}
                      {appointment.attendanceConfirmedAt && appointment.state === "accepted" && (
                        <span className="appt-tag-confirmed">Confirmó</span>
                      )}
                      <span className={state.className}>{state.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      )}

      {/* Debajo de la agenda del día y con la misma caja. Es lo que hay que contestar,
          y va después de lo que hay que hacer hoy: primero se mira con qué se arranca la
          jornada, después se despacha lo que quedó esperando.

          Sin pedidos pendientes la sección no se dibuja. Es una bandeja de entrada, no
          una agenda: el estado normal es que esté vacía, y una caja que dice "no hay
          nada" todos los días deja de leerse igual. */}
      {!simpleView && pendingCount > 0 && (
        <section className="prof-today prof-pending">
          <div className="prof-today-head">
            <div>
              <h2 className="prof-today-title">Pendientes de confirmación</h2>
              <p className="prof-today-date">
                {pendingCount === 1 ? "Un turno pendiente de respuesta" : `${pendingCount} turnos pendientes de respuesta`}
              </p>
            </div>
            <div className="prof-pending-actions adm-btn-row">
              <button type="button" className="adm-btn adm-btn-primary" disabled={accepting} onClick={acceptAll}>
                <FaCheck />
                {pendingCount === 1 ? "Confirmar el turno" : "Confirmar turnos"}
              </button>
              <Link className="adm-btn adm-btn-ghost" to="/AppointmentsList">
                Ver toda la agenda
                <FaArrowRight />
              </Link>
            </div>
          </div>

          <div className="adm-panel">
            <ul className="prof-today-list">
              {pendingSlice.map((appointment) => (
                <li key={appointment.numAppointment}>
                  <button
                      type="button"
                      className="prof-today-item"
                      onClick={() => open(appointment)}
                      {...quickActions(appointment)}
                    >
                    <span className="prof-today-hour">
                      <FaRegClock aria-hidden="true" />
                      {shortHour(appointment.initialHour)}
                    </span>
                    <span className="prof-today-person">
                      {appointment.patient ? (
                        `${appointment.patient.surname}, ${appointment.patient.name}`
                      ) : (
                        <span className="prof-today-free">Sin paciente asignado</span>
                      )}
                      {/* Un pendiente puede ser de cualquier día, así que la fecha va en la
                          fila. En la agenda de hoy sobraría. */}
                      <span className="prof-pending-day">{formatDayLabel(appointmentDate(appointment.date))}</span>
                    </span>
                    <span className="prof-today-room">{appointment.room?.description}</span>
                    {appointment.overbooked && <span className="appt-tag-over">Turno especial</span>}
                    <span className={describeState(appointment.state).className}>
                      {describeState(appointment.state).label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {pendingPages > 1 && (
              <div className="prof-pager">
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-sm"
                  disabled={page === 0}
                  onClick={() => setPendingPage(page - 1)}
                >
                  <FaChevronLeft />
                  Anterior
                </button>
                <span className="prof-pager-page">
                  Página {page + 1} de {pendingPages}
                </span>
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-sm"
                  disabled={page >= pendingPages - 1}
                  onClick={() => setPendingPage(page + 1)}
                >
                  Siguiente
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </section>
      )}


      {/* La lista de espera, con la misma caja que el día. Es gente que ya pidió algo y
          todavía no lo tiene, así que va junto a los pedidos y antes de la plata. Como los
          pedidos, sin nadie no se dibuja, y tampoco con la vista simplificada: se sigue
          viendo entera desde los números. */}
      {!simpleView && waitlist && waitlist.length > 0 && (
        <section className="prof-today prof-waitlist">
          <div className="prof-today-head">
            <div>
              <h2 className="prof-today-title">Lista de espera</h2>
              <p className="prof-today-date">
                {waitlist.length === 1
                  ? "Una persona espera que se libere un horario"
                  : `${waitlist.length} personas esperan que se libere un horario`}
              </p>
            </div>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setWaitlistOpen(true)}>
              Ver la lista
              <FaArrowRight />
            </button>
          </div>

          <div className="adm-panel">
            <ul className="prof-today-list">
              {waitlist.map((person) => (
                <li key={person.id}>
                  <button type="button" className="prof-today-item" onClick={() => setWaitlistOpen(true)}>
                    <span className="prof-today-hour">
                      <FaRegClock aria-hidden="true" />
                      {person.fromHour} a {person.toHour}
                    </span>
                    <span className="prof-today-person">
                      {person.patient.surname}, {person.patient.name}
                      <span className="prof-pending-day">{describeDaysTitle(person.days)}</span>
                    </span>
                    <span className="prof-today-room">
                      {person.noticesSent === 0
                        ? "Todavía sin avisos"
                        : person.noticesSent === 1
                          ? "Un aviso"
                          : `${person.noticesSent} avisos`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Debajo de los pedidos y con la misma caja: es la otra cosa que quedó abierta,
          pero de otra clase. Un pedido espera una respuesta hoy; una consulta sin cobrar
          espera una conversación, y por eso esta caja arranca plegada y solo muestra el
          número. Los dos colores del listado son los del cobro: rojo lo que no se pagó,
          ámbar lo que se pagó a medias. */}
      {!simpleView && unpaidCount > 0 && (
        <section className="prof-today prof-unpaid">
          <div className="prof-today-head">
            <button
              type="button"
              className="prof-unpaid-toggle"
              aria-expanded={unpaidOpen}
              onClick={() => setUnpaidOpen(!unpaidOpen)}
            >
              <span className="prof-unpaid-text">
                <span className="prof-today-title">Sin cobrar</span>
                <span className="prof-today-date">
                  {unpaidCount === 1 ? "Un turno atendido sin cobrar" : `${unpaidCount} turnos atendidos sin cobrar`}
                  {owed > 0 ? ` · faltan $${owed}` : ""}
                  {unpaidShown < unpaidCount ? ` · acá se ven los ${unpaidShown} más recientes` : ""}
                </span>
              </span>
              <FaChevronDown className={`prof-unpaid-caret ${unpaidOpen ? "open" : ""}`} aria-hidden="true" />
            </button>

            {/* Va afuera del que despliega la caja: un botón adentro de otro no es válido,
                y además son dos acciones distintas que conviene no confundir de un toque. */}
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={settling}
              onClick={() => setConfirmingSettle(true)}
            >
              <FaMoneyBillWave />
              {unpaidCount === 1 ? "Considerar cobrado" : "Considerar todos cobrados"}
            </button>
          </div>

          <div className={`adm-collapsible ${unpaidOpen ? "open" : ""}`}>
            <div>
              <div className="adm-panel" inert={!unpaidOpen}>
                <ul className="prof-today-list">
                  {unpaid?.map((appointment) => {
                    const payment = describePayment(appointment);

                    return (
                      <li key={appointment.numAppointment}>
                        <button
                      type="button"
                      className="prof-today-item"
                      onClick={() => open(appointment)}
                      {...quickActions(appointment)}
                    >
                          <span className="prof-today-hour">
                            <FaRegClock aria-hidden="true" />
                            {shortHour(appointment.initialHour)}
                          </span>
                          <span className="prof-today-person">
                            {appointment.patient
                              ? `${appointment.patient.surname}, ${appointment.patient.name}`
                              : "Sin paciente asignado"}
                            <span className="prof-pending-day">{formatDayLabel(appointmentDate(appointment.date))}</span>
                          </span>
                          {pendingAmount(appointment) > 0 && (
                            <span className="prof-unpaid-owed">Debe ${pendingAmount(appointment)}</span>
                          )}
                          {payment && <span className={payment.className}>{payment.label}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <ProfessionalSettings />

      {/* Abajo de todo, después de la configuración: se lee una vez y después estorba.
          Con la vista simplificada no se dibuja: es ayuda de teclado, y quien pidió menos
          cosas en pantalla no está buscando atajos. */}
      {!simpleView && <ShortcutsPanel />}

      {professional && <AppointmentDetailModal user={professional} {...detailProps} />}

      <CancelAppointmentModal {...cancelProps} />

      <WaitlistPeopleModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} onChanged={setWaitlist} />

      {/*
        Preguntar antes de saldar todo.
        ------------------------------
        Confirmar los pedidos de una no lo pregunta, y acá sí, porque no es lo mismo: esto
        declara plata como cobrada, y para volver atrás hay que abrir los turnos de a uno.
        El cartel dice el número y el monto porque es lo único que deja darse cuenta de que
        se apretó el botón equivocado antes de que sea tarde.
      */}
      <Modal
        open={confirmingSettle}
        onClose={() => setConfirmingSettle(false)}
        title="¿Darlos todos por cobrados?"
        size="sm"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingSettle(false)}>
              Volver
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={settleAll} disabled={settling}>
              <FaMoneyBillWave />
              Sí, darlos por cobrados
            </button>
          </>
        }
      >
        <p className="adm-confirm-lead">
          {unpaidCount === 1 ? "Se marca como cobrado 1 turno" : `Se marcan como cobrados ${unpaidCount} turnos`}
          {owed > 0 ? `, $${owed}` : ""}.
        </p>
        <p className="adm-confirm-note">
          Incluye todos los turnos atendidos sin saldar. Para revertirlo hay que cambiar cada turno a mano.
        </p>
      </Modal>

      <Toasts />
    </div>
  );
}
