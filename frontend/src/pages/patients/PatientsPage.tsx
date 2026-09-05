import { useEffect, useMemo, useState } from "react";
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
  updatePatient,
  type AnonymousPatientInput,
} from "./patientsService.ts";
import { getPatientMedicalHistory } from "../appointments/appointmentsService.ts";
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

  // Una sola ventana sirve para el alta y para la corrección: `editing` guarda a quién
  // se está editando, y en null significa que se está creando uno nuevo.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState<AnonymousPatientInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openPatient(patient: Person) {
    setEditing(patient);
    setHistory(null);
    setLoadingHistory(true);

    getPatientMedicalHistory(patient.email)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));

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
        const updated = await updatePatient(editing.email, data);
        setPatients((prev) => prev.map((p) => (p.email === editing.email ? { ...p, ...updated } : p)));
        toast.success("Paciente actualizado");
      } else {
        const created = await createAnonymousPatient({ ...data, email: form.email.trim() });
        setPatients((prev) => [created, ...prev]);
        toast.success("Paciente creado");
      }
      setModalOpen(false);
      setFormError(null);
    } catch (err: any) {
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

            {loadingHistory ? (
              <SkeletonList rows={3} />
            ) : !history || history.length === 0 ? (
              <p className="adm-empty">Todavía no tuvo ningún turno con vos.</p>
            ) : (
              <ul className="patients-history-list">
                {history.map((appointment) => {
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
