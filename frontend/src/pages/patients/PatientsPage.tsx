import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaAddressBook, FaMoneyBillWave, FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { Modal } from "../../components/modal/Modal.tsx";
import { PeopleList, PeopleSearch, PersonRow } from "../../components/peopleList/PeopleList.tsx";
import {
  findAllPatients,
  findMyPatients,
  createAnonymousPatient,
  deleteAnonymousPatient,
  updatePatient,
  type AnonymousPatientInput,
} from "./patientsService.ts";
import { useUndo } from "../../context/UndoContext.tsx";
import { getPatientMedicalHistory } from "../appointments/appointmentsService.ts";
import { isCancelled, pendingAmount } from "../appointments/appointmentTypes.ts";
import { ContactPatientModal } from "./ContactPatientModal.tsx";
import { findPerson, getDecodedToken } from "../commonServices.ts";
import type { Appointment } from "../types.ts";
import type { Person } from "../types.ts";
import { useSimpleText } from "../../lib/textMode.ts";

const emptyForm: AnonymousPatientInput = {
  email: "",
  name: "",
  surname: "",
  docType: "DNI",
  docNumber: "",
  phoneNumber: "",
};

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/**
 * De quien es la lista. Arranca en los propios: es lo que el profesional busca casi
 * siempre. Los del consultorio entero quedan a un click, para cuando hay que darle turno
 * a alguien que todavia no atendio.
 */
type Scope = "mine" | "all";

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

export function PatientsPage() {
  const [simple] = useSimpleText();
  const [patients, setPatients] = useState<Person[]>([]);
  // Quién está logueado: firma el borrador del mail que se le abre al paciente.
  const [me, setMe] = useState<Person | undefined>(undefined);
  const [contacting, setContacting] = useState<Person | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Filtrar por deuda. Vive aparte del alcance porque es un recorte de lo que ya se
  // está mirando, y no otra lista.
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [scope, setScope] = useState<Scope>("mine");
  // El historial del paciente abierto: los turnos que tuvo con este profesional.
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

  // Una sola ventana sirve para el alta y para la corrección: `editing` guarda a quién
  // se está editando, y en null significa que se está creando uno nuevo.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState<AnonymousPatientInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { remember } = useUndo();

  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    findPerson(decoded.email)
      .then((data) => setMe(data ?? undefined))
      .catch(() => setMe(undefined));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (scope === "mine" ? findMyPatients() : findAllPatients())
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`No pudimos cargar los pacientes: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  // Cuántos le quedaron debiendo algo. Solo tiene sentido en los propios: la deuda es
  // con este profesional, y el listado de todos ni siquiera la trae.
  const debtors = useMemo(() => patients.filter((patient) => patient.owesPayment).length, [patients]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return patients.filter((patient) => {
      if (onlyDebtors && !patient.owesPayment) return false;
      if (!term) return true;

      return (
        normalize(patient.name).includes(term) ||
        normalize(patient.surname).includes(term) ||
        normalize(patient.email).includes(term)
      );
    });
  }, [search, patients, onlyDebtors]);

  /**
   * El número del último historial que se pidió. Solo ese puede escribir en la pantalla.
   *
   * Abrir una ficha, cerrarla y abrir otra dispara dos pedidos sin esperar al primero, y
   * nada garantiza que vuelvan en orden. Sin esto, el que llegaba último ganaba: la ficha
   * de una persona mostraba el historial clínico de otra, con su nombre arriba.
   *
   * Se adelanta también al abrir el alta y al cerrar, para que una respuesta que llega
   * tarde no caiga sobre una ficha que ya no es la suya.
   */
  const ultimoHistorial = useRef(0);

  function openNew() {
    ultimoHistorial.current += 1;
    setHistoryFilters([]);
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  /*
   * El atajo de teclado para dar de alta un paciente termina acá.
   *
   * Llega por la dirección porque se aprieta desde cualquier pantalla, y el parámetro se
   * borra apenas se usa: si quedara pegado, recargar o volver con el botón de atrás
   * abriría la ventana de nuevo sin que nadie la haya pedido.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!searchParams.has("nuevo")) return;
    ultimoHistorial.current += 1;
    setHistoryFilters([]);
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  function openPatient(patient: Person) {
    setEditing(patient);
    setHistory(null);
    // Los recortes son de la ficha que se estaba mirando, no del paciente que se abre
    // ahora: dejarlos puestos abriría el historial del siguiente ya escondiendo cosas.
    setHistoryFilters([]);
    setLoadingHistory(true);

    const mio = ++ultimoHistorial.current;
    const vigente = () => mio === ultimoHistorial.current;

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

    setForm({
      email: patient.email,
      name: patient.name,
      surname: patient.surname,
      docType: patient.docType || "DNI",
      docNumber: patient.docNumber || "",
      phoneNumber: patient.phoneNumber || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  // Los pacientes con cuenta propia se muestran, pero no se tocan desde acá.
  const readOnly = !!editing && !editing.anonymous;

  // El historial ya recortado. Sin filtros puestos es el historial entero.
  const shownHistory = useMemo(() => {
    if (!history) return [];
    if (historyFilters.length === 0) return history;

    const puestos = HISTORY_FILTERS.filter((filter) => historyFilters.includes(filter.value));
    return history.filter((appointment) => puestos.some((filter) => filter.matches(appointment)));
  }, [history, historyFilters]);

  function validate(): string | null {
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "El email no tiene un formato válido";
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
      if (editing) {
        const antes = editing;
        const updated = await updatePatient(editing.email, data);
        setPatients((prev) => prev.map((p) => (p.email === editing.email ? { ...p, ...updated } : p)));
        toast.success("Paciente actualizado");

        // Los datos de antes, tal como estaban en la fila. Solo se puede sobre un paciente
        // sin cuenta, que son los únicos que este profesional puede editar.
        remember({
          label: "Volvieron los datos anteriores del paciente",
          undo: async () => {
            const vuelto = await updatePatient(antes.email, {
              name: antes.name,
              surname: antes.surname,
              docType: antes.docType || "DNI",
              docNumber: antes.docNumber || "",
              phoneNumber: antes.phoneNumber || "",
            });
            setPatients((prev) => prev.map((p) => (p.email === antes.email ? { ...p, ...vuelto } : p)));
          },
        });
      } else {
        const created = await createAnonymousPatient({ ...data, email: form.email.trim() });
        setPatients((prev) => [created, ...prev]);
        toast.success("Paciente creado");

        // Deshacer el alta lo borra de verdad. El backend solo lo deja mientras no tenga
        // ningún turno, que recién creado es siempre el caso.
        remember({
          label: `Se borró el paciente ${created.surname}, ${created.name}`,
          undo: async () => {
            await deleteAnonymousPatient(created.email);
            setPatients((prev) => prev.filter((p) => p.email !== created.email));
          },
        });
      }
      setModalOpen(false);
      setFormError(null);
    } catch (err: any) {
      remember(null);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-page">
      <AdminHeader
        title="Pacientes"
        subtitle={
          scope === "mine"
            ? "Las personas a las que les diste turno alguna vez"
            : "Todos los pacientes del consultorio, con cuenta y anónimos"
        }
        backTo="/ProfessionalHome"
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openNew}>
            <FaPlus />
            Nuevo paciente anónimo
          </button>
        }
      />

      <Toasts />

      {!simple && (
        <p className="people-note">
          Un paciente <strong>anónimo</strong> no tiene cuenta ni contraseña. Sirve para anotarlo sin que tenga que registrarse. Podés
          corregirle los datos cuando quieras. Si más adelante se registra con ese mismo email, la cuenta pasa a ser real y conserva
          todo lo que le hayas cargado.
        </p>
      )}

      {/* Arranca en los propios: es lo que se busca casi siempre. Ver a todos sirve
          cuando hay que darle turno a alguien que todavía no se atendió acá. */}
      <div className="patients-scope" role="group" aria-label="Qué pacientes mostrar">
        <button
          type="button"
          className={`adm-btn adm-btn-ghost ${scope === "mine" ? "active" : ""}`}
          aria-pressed={scope === "mine"}
          onClick={() => setScope("mine")}
        >
          Mis pacientes
        </button>
        <button
          type="button"
          className={`adm-btn adm-btn-ghost ${scope === "all" ? "active" : ""}`}
          aria-pressed={scope === "all"}
          onClick={() => {
            // Ver a todos no trae la deuda: dejar el filtro puesto vaciaría la lista sin
            // que se entienda por qué.
            setOnlyDebtors(false);
            setScope("all");
          }}
        >
          Todos los pacientes
        </button>

        {/* Contra el borde derecho y solo entre los propios: es un recorte de esa lista. */}
        {scope === "mine" && (
          <button
            type="button"
            className={`adm-btn adm-btn-ghost patients-debt-filter ${onlyDebtors ? "active" : ""}`}
            aria-pressed={onlyDebtors}
            disabled={debtors === 0 && !onlyDebtors}
            title={debtors === 0 ? "Nadie te quedó debiendo" : "Solo los que te quedaron debiendo"}
            onClick={() => setOnlyDebtors(!onlyDebtors)}
          >
            <FaMoneyBillWave />
            Adeudan
            <span className="adm-chip-count">{debtors}</span>
          </button>
        )}
      </div>

      <PeopleSearch value={search} onChange={setSearch} placeholder="Buscar por nombre, apellido o email" />

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={6} />
        ) : patients.length === 0 ? (
          <div className="adm-empty">
            {scope === "mine"
              ? "Todavía no le diste turno a nadie. Acá van a aparecer los pacientes que atiendas."
              : "Todavía no hay pacientes cargados."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">Ningún paciente coincide con la búsqueda.</div>
        ) : (
          <PeopleList>
            {filtered.map((patient) => (
              <PersonRow
                key={patient.email}
                name={patient.name}
                surname={patient.surname}
                meta={patient.email}
                tone={patient.anonymous ? "amber" : "green"}
                badges={[
                  patient.anonymous
                    ? { label: "Anónimo", tone: "amber" as const }
                    : { label: "Con cuenta", tone: "green" as const },
                  // Un pago a medias también es una deuda: lo que se mira es si quedó algo
                  // sin cobrar, no si no pagó nada.
                  ...(patient.owesPayment
                    ? [
                        {
                          label:
                            (patient.owedAppointments ?? 0) === 1 ? "Adeuda un pago" : `Adeuda ${patient.owedAppointments} pagos`,
                          tone: "red" as const,
                          hint: `Le quedaron $${patient.owedAmount ?? 0} sin pagar. Se registra desde la ficha de cada turno.`,
                        },
                      ]
                    : []),
                ]}
                onClick={() => openPatient(patient)}
                // Solo en los propios: contactar a alguien que nunca atendiste no es
                // una acción que la pantalla tenga por qué ofrecer.
                action={
                  scope === "mine" ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      onClick={() => setContacting(patient)}
                    >
                      <FaAddressBook />
                      Contactar
                    </button>
                  ) : undefined
                }
              />
            ))}
          </PeopleList>
        )}
      </div>

      <ContactPatientModal
        open={!!contacting}
        onClose={() => setContacting(undefined)}
        patient={contacting}
        professional={me}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="sm"
        title={editing ? (readOnly ? "Datos del paciente" : "Editar paciente") : "Nuevo paciente anónimo"}
        subtitle={editing ? editing.email : "Sin cuenta ni contraseña"}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setModalOpen(false)}>
              {readOnly ? "Cerrar" : "Cancelar"}
            </button>
            {!readOnly && (
              <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear paciente"}
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

          {!editing && (
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

        {editing && (
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
                          prev.includes(filter.value)
                            ? prev.filter((value) => value !== filter.value)
                            : [...prev, filter.value]
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

                  return (
                    <li key={appointment.numAppointment} className="patients-history-item">
                      <div className="patients-history-when">
                        <strong>{historyDate(appointment.date)}</strong>
                        <span>{appointment.initialHour?.slice(0, 5)}</span>
                      </div>

                      <div className="patients-history-what">
                        <span className={state.className}>{state.label}</span>
                        {appointment.observations ? (
                          <p className="patients-history-note">{appointment.observations}</p>
                        ) : (
                          <p className="patients-history-note patients-history-empty">Sin observaciones</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
