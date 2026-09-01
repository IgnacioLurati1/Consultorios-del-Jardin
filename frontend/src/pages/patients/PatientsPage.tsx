import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { Modal } from "../../components/modal/Modal.tsx";
import { PeopleList, PeopleSearch, PersonRow } from "../../components/peopleList/PeopleList.tsx";
import { findAllPatients, createAnonymousPatient, updatePatient, type AnonymousPatientInput } from "./patientsService.ts";
import type { Person } from "../types.ts";

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

export function PatientsPage() {
  const [patients, setPatients] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Una sola ventana sirve para el alta y para la corrección: `editing` guarda a quién
  // se está editando, y en null significa que se está creando uno nuevo.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState<AnonymousPatientInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    findAllPatients()
      .then(setPatients)
      .catch((err) => toast.error(`No pudimos cargar los pacientes: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return patients;

    return patients.filter(
      (p) => normalize(p.name).includes(term) || normalize(p.surname).includes(term) || normalize(p.email).includes(term)
    );
  }, [search, patients]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openPatient(patient: Person) {
    setEditing(patient);
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
        subtitle="Pacientes con cuenta y pacientes anónimos cargados por vos"
        backTo="/ProfessionalHome"
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openNew}>
            <FaPlus />
            Nuevo paciente anónimo
          </button>
        }
      />

      <Toasts />

      <p className="people-note">
        Un paciente <strong>anónimo</strong> no tiene cuenta ni contraseña: sirve para anotarlo sin que tenga que registrarse. Podés
        corregirle los datos cuando quieras. Si más adelante se registra con ese mismo email, la cuenta pasa a ser real y conserva todo
        lo que le hayas cargado.
      </p>

      <PeopleSearch value={search} onChange={setSearch} placeholder="Buscar por nombre, apellido o email" />

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={6} />
        ) : patients.length === 0 ? (
          <div className="adm-empty">Todavía no hay pacientes cargados.</div>
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
                ]}
                onClick={() => openPatient(patient)}
              />
            ))}
          </PeopleList>
        )}
      </div>

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
      </Modal>
    </div>
  );
}
