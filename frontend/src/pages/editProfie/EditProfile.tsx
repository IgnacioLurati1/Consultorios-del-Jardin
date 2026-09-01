import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaFloppyDisk } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { updatePerson } from "./editProfileServices";
import { findPerson, getDecodedToken } from "../commonServices";
import type { Person } from "../types";
import "./EditProfile.css";

const DOC_TYPES = ["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  professional: "Profesional",
  client: "Paciente",
};

const HOME_BY_TYPE: Record<string, string> = {
  admin: "/AdminHome",
  professional: "/ProfessionalHome",
  client: "/",
};

const emptyForm = { name: "", surname: "", email: "", phoneNumber: "", docType: "DNI", docNumber: "" };

export function EditProfile() {
  const [person, setPerson] = useState<Person | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decoded = getDecodedToken();

  useEffect(() => {
    if (!decoded) {
      setLoading(false);
      return;
    }

    findPerson(decoded.email)
      .then((data) => {
        if (!data) {
          toast.error("No encontramos tus datos");
          return;
        }

        setPerson(data);
        setForm({
          name: data.name,
          surname: data.surname,
          email: data.email,
          docType: data.docType || "DNI",
          docNumber: data.docNumber || "",
          phoneNumber: data.phoneNumber || "",
        });
      })
      .catch((err) => toast.error(`No pudimos cargar tus datos: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  function validate(): string | null {
    if (!form.name.trim() || !form.surname.trim()) return "El nombre y el apellido no pueden quedar vacíos";
    if (!/^\d+$/.test(form.docNumber.trim())) return "El documento tiene que tener solo dígitos";
    if (!/^\d{10}$/.test(form.phoneNumber.replace(/\D/g, "")))
      return "El teléfono tiene que tener 10 dígitos, sin 0 ni 15 (ej: 3411234567)";
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    toast.dismiss();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSaving(true);

    updatePerson({
      email: form.email,
      name: form.name.trim(),
      surname: form.surname.trim(),
      phoneNumber: form.phoneNumber.replace(/\D/g, ""),
      docType: form.docType,
      docNumber: form.docNumber.trim(),
    })
      .then(() => toast.success("Datos guardados"))
      .catch((err: any) => {
        const message = err.response?.data?.message || err.message;
        setError(message);
      })
      .finally(() => setSaving(false));
  }

  const initials = person ? `${person.name.charAt(0)}${person.surname.charAt(0)}`.toUpperCase() : "";
  const role = decoded ? ROLE_LABEL[decoded.type] ?? decoded.type : "";

  return (
    <div className="adm-page">
      <AdminHeader
        title="Mis datos"
        subtitle="Lo que ven los profesionales cuando te dan un turno"
        backTo={decoded ? HOME_BY_TYPE[decoded.type] ?? "/" : "/"}
        backLabel="Volver"
      />

      <Toasts />

      <form className="profile-layout" onSubmit={handleSubmit}>
        <aside className="profile-card">
          {loading ? (
            <>
              <SkeletonLine width="72px" height={72} />
              <SkeletonLine width="160px" height={18} />
              <SkeletonLine width="120px" height={14} />
            </>
          ) : (
            <>
              <span className="profile-avatar">{initials}</span>
              <span className="profile-card-name">
                {form.name} {form.surname}
              </span>
              <span className="profile-card-mail">{form.email}</span>
              {role && <span className="adm-badge adm-badge-green">{role}</span>}
            </>
          )}
        </aside>

        <div className="adm-panel profile-form">
          {loading ? (
            <div className="profile-form-loading">
              <SkeletonLine height={44} />
              <SkeletonLine height={44} />
              <SkeletonLine height={44} />
            </div>
          ) : (
            <>
              <div className="ui-section">
                <h2 className="ui-section-title">Datos personales</h2>

                <div className="ui-field-row">
                  <label className="ui-field">
                    <span>Nombre</span>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="ui-field">
                    <span>Apellido</span>
                    <input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                  </label>
                </div>

                <label className="ui-field">
                  <span>Email</span>
                  <input value={form.email} disabled />
                  <small>El email identifica tu cuenta, así que no se puede cambiar.</small>
                </label>
              </div>

              <div className="ui-section">
                <h2 className="ui-section-title">Contacto y documento</h2>

                <label className="ui-field">
                  <span>Teléfono</span>
                  <input
                    value={form.phoneNumber}
                    placeholder="3411234567"
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  />
                </label>

                <div className="ui-field-row">
                  <label className="ui-field">
                    <span>Tipo de documento</span>
                    <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                      {DOC_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-field">
                    <span>Número de documento</span>
                    <input value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
                  </label>
                </div>
              </div>

              {error && <p className="ui-alert ui-alert-error profile-error">{error}</p>}

              <div className="profile-actions">
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                  <FaFloppyDisk />
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
