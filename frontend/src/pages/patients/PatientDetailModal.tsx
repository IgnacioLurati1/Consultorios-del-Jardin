import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { getPatientMedicalHistory } from "../appointments/appointmentsService.ts";
import { isCancelled, pendingAmount } from "../appointments/appointmentTypes.ts";
import type { Appointment, Person } from "../types.ts";
import { createAnonymousPatient, updatePatient, type AnonymousPatientInput } from "./patientsService.ts";

const emptyForm: AnonymousPatientInput = {
  email: "",
  name: "",
  surname: "",
  docType: "DNI",
  docNumber: "",
  phoneNumber: "",
};

/** El estado del turno puede ser un ISO timestamp: eso significa cancelado. */
function describeState(state: string): { label: string; className: string } {
  switch (state) {
    case "pending":
      return { label: "A confirmar", className: "adm-badge adm-badge-amber" };
    case "accepted":
      return { label: "Confirmado", className: "adm-badge adm-badge-green" };
    case "assisted":
      return { label: "Asistió", className: "adm-badge adm-badge-grey" };
    case "missed":
      return { label: "No vino", className: "adm-badge adm-badge-amber" };
    default:
      return { label: "Cancelado", className: "adm-badge adm-badge-red" };
  }
}

/* ============================================================
   Recortes del historial clínico
   ============================================================ */

/**
 * Por qué se mira un historial.
 *
 * No son "los estados de un turno": son las cinco preguntas que alguien le hace a la
 * ficha de un paciente. Cuatro salen del estado y la quinta de la plata, que es un dato
 * de otro lado, y por eso esto es una lista propia y no la de estados de siempre.
 */
type HistoryFilter = "owed" | "missed" | "assisted" | "cancelled" | "accepted";

const HISTORY_FILTERS: { value: HistoryFilter; label: string; matches: (appointment: Appointment) => boolean }[] = [
  { value: "owed", label: "Adeuda", matches: (appointment) => pendingAmount(appointment) > 0 },
  { value: "missed", label: "No vino", matches: (appointment) => appointment.state === "missed" },
  { value: "assisted", label: "Asistió", matches: (appointment) => appointment.state === "assisted" },
  { value: "cancelled", label: "Cancelado", matches: (appointment) => isCancelled(appointment.state) },
  { value: "accepted", label: "Confirmado", matches: (appointment) => appointment.state === "accepted" },
];

/** La fecha del turno se guarda a medianoche UTC: leerla en local la corre un día. */
function historyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

interface PatientDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** A quién se está mirando. En null la ventana es el alta de un paciente anónimo. */
  patient: Person | null;
  /**
   * El paciente que quedó guardado, para que la lista de atrás se entere. `previous` son
   * sus datos de antes, y en null significa que se acaba de crear.
   */
  onSaved?: (saved: Person, previous: Person | null) => void;
  /** Qué hacer si algo salió mal después de haber anunciado que se guardaba. */
  onFailed?: () => void;
  /**
   * Abrir la ficha de un turno del historial.
   *
   * Sin esto el historial se lee y nada más, que es como se muestra cuando esta ventana
   * ya se abrió desde la ficha de un turno: ahí, seguir abriendo turnos apilaría ventanas
   * sobre ventanas sin que se entienda a cuál se vuelve al cerrar.
   */
  onOpenAppointment?: (appointment: Appointment) => void;
  /** Cambiarlo vuelve a pedir el historial. Sirve después de tocar uno de sus turnos. */
  historyToken?: number;
}

/**
 * La ficha de un paciente: sus datos y todo lo que se atendió con vos.
 *
 * Se abre desde el listado de pacientes y también desde el nombre que figura en la ficha
 * de un turno, que es donde más se pregunta quién es esta persona —el teléfono para
 * avisarle algo, si ya faltó otras veces, qué se le viene cobrando—.
 */
export function PatientDetailModal({
  open,
  onClose,
  patient,
  onSaved,
  onFailed,
  onOpenAppointment,
  historyToken = 0,
}: PatientDetailModalProps) {
  const [form, setForm] = useState<AnonymousPatientInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Appointment[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  /*
   * Qué recortes del historial están puestos.
   *
   * Se suman entre sí en lugar de cruzarse: con "Adeuda" y "No vino" prendidos se ven los
   * dos grupos, no los que cumplen las dos cosas. Es lo que espera el que prende otro
   * filtro para ver un poco más, y cruzarlos deja la lista vacía casi siempre.
   *
   * Sin ninguno prendido se ve el historial entero, que es como estaba antes de que esto
   * existiera y es lo que hay que ver cuando uno abre una ficha sin buscar nada puntual.
   */
  const [historyFilters, setHistoryFilters] = useState<HistoryFilter[]>([]);

  // Los pacientes con cuenta propia se muestran, pero no se tocan desde acá.
  const readOnly = !!patient && !patient.anonymous;

  /**
   * El número del último historial que se pidió. Solo ese puede escribir en la pantalla.
   *
   * Abrir una ficha, cerrarla y abrir otra dispara dos pedidos sin esperar al primero, y
   * nada garantiza que vuelvan en orden. Sin esto, el que llegaba último ganaba: la ficha
   * de una persona mostraba el historial clínico de otra, con su nombre arriba.
   */
  const ultimoHistorial = useRef(0);

  const email = patient?.email;

  useEffect(() => {
    if (!open) return;

    // Se adelanta también en el alta y cada vez que se abre, para que una respuesta que
    // llega tarde no caiga sobre una ficha que ya no es la suya.
    const mio = ++ultimoHistorial.current;
    const vigente = () => mio === ultimoHistorial.current;

    setFormError(null);
    // Los recortes son de la ficha que se estaba mirando, no de la que se abre ahora:
    // dejarlos puestos abriría el historial del siguiente ya escondiendo cosas.
    setHistoryFilters([]);
    setHistory(null);

    if (!patient) {
      setForm(emptyForm);
      return;
    }

    setForm({
      email: patient.email,
      name: patient.name,
      surname: patient.surname,
      docType: patient.docType || "DNI",
      docNumber: patient.docNumber || "",
      phoneNumber: patient.phoneNumber || "",
    });

    setLoadingHistory(true);

    getPatientMedicalHistory(patient.email)
      .then((historial) => {
        if (vigente()) setHistory(historial);
      })
      .catch(() => {
        if (vigente()) setHistory([]);
      })
      .finally(() => {
        if (vigente()) setLoadingHistory(false);
      });

    // `patient` entero no va: la lista de atrás lo reemplaza al guardar, y eso volvería a
    // pedir el historial y a pisar lo que se esté escribiendo. Lo que identifica la ficha
    // es de quién es.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email, historyToken]);

  // El historial ya recortado. Sin filtros puestos es el historial entero.
  const shownHistory = useMemo(() => {
    if (!history) return [];
    if (historyFilters.length === 0) return history;

    const puestos = HISTORY_FILTERS.filter((filter) => historyFilters.includes(filter.value));
    return history.filter((appointment) => puestos.some((filter) => filter.matches(appointment)));
  }, [history, historyFilters]);

  function validate(): string | null {
    if (!patient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "El email no tiene un formato válido";
    if (!form.name.trim() || !form.surname.trim()) return "El nombre y el apellido son obligatorios";
    if (form.docNumber && !/^\d+$/.test(form.docNumber.trim())) return "El documento tiene que tener solo dígitos";
    if (form.phoneNumber && !/^\d{10}$/.test(form.phoneNumber.replace(/\D/g, "")))
      return "El teléfono tiene que tener 10 dígitos, sin 0 ni 15 (ej: 3411234567)";
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }

    const data = {
      name: form.name.trim(),
      surname: form.surname.trim(),
      docType: form.docType,
      docNumber: form.docNumber?.trim(),
      phoneNumber: form.phoneNumber?.replace(/\D/g, ""),
    };

    setSaving(true);
    try {
      const saved = patient
        ? await updatePatient(patient.email, data)
        : await createAnonymousPatient({ ...data, email: form.email.trim() });

      // El aviso lo da la ventana y no la pantalla de atrás: esta ficha también se abre
      // desde la de un turno, y ahí guardar no tenía ninguna respuesta.
      toast.success(patient ? "Paciente actualizado" : "Paciente creado");
      onSaved?.(saved, patient);
      setFormError(null);
      onClose();
    } catch (err: any) {
      onFailed?.();
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={patient ? (readOnly ? "Datos del paciente" : "Editar paciente") : "Nuevo paciente anónimo"}
      subtitle={patient ? patient.email : "Sin cuenta ni contraseña"}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            {readOnly ? "Cerrar" : "Cancelar"}
          </button>
          {!readOnly && (
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : patient ? "Guardar cambios" : "Crear paciente"}
            </button>
          )}
        </>
      }
    >
      <div className="ui-section">
        {readOnly && (
          <p className="ui-alert ui-alert-info">
            Esta persona ya tiene su propia cuenta, así que sus datos los edita ella desde su perfil.
          </p>
        )}

        {!patient && (
          <label className="ui-field">
            <span>Email</span>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="paciente@mail.com" />
            <small>Si esta persona se registra con este email, hereda todo lo que le cargues.</small>
          </label>
        )}

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Nombre</span>
            <input value={form.name} disabled={readOnly} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="ui-field">
            <span>Apellido</span>
            <input value={form.surname} disabled={readOnly} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          </label>
        </div>

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Tipo de documento</span>
            <select value={form.docType} disabled={readOnly} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
              <option value="DNI">DNI</option>
              <option value="LC">LC</option>
              <option value="LE">LE</option>
              <option value="Pasaporte">Pasaporte</option>
            </select>
          </label>
          <label className="ui-field">
            <span>Número de documento</span>
            <input value={form.docNumber} disabled={readOnly} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
          </label>
        </div>

        <label className="ui-field">
          <span>Teléfono</span>
          <input
            value={form.phoneNumber}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            placeholder="3411234567"
          />
        </label>

        {formError && <p className="ui-alert ui-alert-error">{formError}</p>}
      </div>

      {patient && (
        <div className="ui-section patients-history">
          <h3 className="patients-history-title">Historial con vos</h3>

          {/* Los recortes, cada uno con cuántos turnos tiene detrás. El número es lo que
              convierte la fila en un resumen del paciente antes de tocar nada, y lo que
              hace que no se prenda un filtro para descubrir que no hay nada adentro. */}
          {!loadingHistory && history && history.length > 0 && (
            <div className="patients-history-filters" role="group" aria-label="Filtrar el historial">
              {HISTORY_FILTERS.map((filter) => {
                const count = history.filter(filter.matches).length;
                const active = historyFilters.includes(filter.value);

                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={`adm-btn adm-btn-ghost adm-btn-sm ${active ? "active" : ""}`}
                    aria-pressed={active}
                    disabled={count === 0 && !active}
                    onClick={() =>
                      setHistoryFilters((prev) =>
                        prev.includes(filter.value) ? prev.filter((value) => value !== filter.value) : [...prev, filter.value]
                      )
                    }
                  >
                    {filter.label}
                    <span className="adm-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {loadingHistory ? (
            <SkeletonList rows={3} />
          ) : !history || history.length === 0 ? (
            <p className="adm-empty">Todavía no tuvo ningún turno con vos.</p>
          ) : shownHistory.length === 0 ? (
            <p className="adm-empty">Ningún turno entra en lo que estás filtrando.</p>
          ) : (
            <ul className="patients-history-list">
              {shownHistory.map((appointment) => {
                const state = describeState(appointment.state);

                const content = (
                  <>
                    <span className="patients-history-when">
                      <strong>{historyDate(appointment.date)}</strong>
                      <span>{appointment.initialHour?.slice(0, 5)}</span>
                    </span>

                    <span className="patients-history-what">
                      <span className={state.className}>{state.label}</span>
                      {appointment.observations ? (
                        <span className="patients-history-note">{appointment.observations}</span>
                      ) : (
                        <span className="patients-history-note patients-history-empty">Sin observaciones</span>
                      )}
                    </span>
                  </>
                );

                return (
                  <li key={appointment.numAppointment}>
                    {/* El renglón entero abre la ficha del turno. Hasta acá el historial
                        se leía y nada más, y para corregir una observación o registrar
                        un cobro había que salir, ir a la lista de turnos y buscar el
                        día. Es la misma ficha de siempre, con las mismas acciones.

                        El paciente se le agrega al pasarlo. El historial son todos
                        turnos del mismo, así que el servidor manda ahí solo su mail y no
                        la persona entera, y la ficha, que sí la muestra, escribía
                        "undefined, undefined". Se le pone el que está abierto, que es de
                        quien es el historial por definición. */}
                    {onOpenAppointment ? (
                      <button
                        type="button"
                        className="patients-history-item"
                        onClick={() => onOpenAppointment({ ...appointment, patient })}
                        title="Ver la ficha del turno"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="patients-history-item readonly">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
