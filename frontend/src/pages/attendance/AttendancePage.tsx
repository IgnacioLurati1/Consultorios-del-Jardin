import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import { API_BASE_URL } from "../../axios.ts";
import { appointmentDate, formatDayLabel } from "../appointments/appointmentTypes.ts";
import "../newPassword/passwordPages.css";

interface AttendanceView {
  numAppointment: number;
  date: string;
  initialHour: string;
  finalHour: string;
  professional: { name: string; surname: string; speciality: string | null };
  room: string | null;
  status: "pending" | "accepted" | "assisted" | "missed" | "cancelled";
  confirmedAt: string | null;
}

/**
 * Lo que abren los botones del mail del día anterior: "Sí, voy" y "No puedo ir".
 *
 * Nada se contesta con solo abrir la página. Los programas de correo abren los links por
 * su cuenta para revisarlos, y si abrir alcanzara, un "No puedo ir" cancelaría turnos que
 * nadie canceló. Por eso siempre hace falta un toque acá, con el turno a la vista.
 *
 * No va por `api`: su interceptor pondría la sesión de quien esté logueado en esta
 * computadora, y el link no es de esa persona sino del turno. Lo que lo autoriza es la
 * firma que viaja en la dirección.
 */
export function AttendancePage() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const asked = params.get("r");

  const [view, setView] = useState<AttendanceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Qué contestó recién, para mostrar el cierre que le corresponde. */
  const [answered, setAnswered] = useState<"yes" | "no" | null>(null);
  /** "No puedo ir" se confirma: del otro lado hay un turno que se cancela. */
  const [confirmingNo, setConfirmingNo] = useState(asked === "no");

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${API_BASE_URL}/attendance/${encodeURIComponent(token)}`)
      .then((response) => setView(response.data.data))
      .catch((err) => setError(err.response?.data?.message || "No pudimos abrir este turno. Probá de nuevo en un rato"));
  }, [token]);

  async function answer(value: "yes" | "no") {
    if (!token) return;
    setSaving(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/attendance/${encodeURIComponent(token)}`, { answer: value });
      setView(response.data.data);
      setAnswered(value);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      setError(data?.message || "No pudimos guardar tu respuesta. Probá de nuevo en un rato");
    } finally {
      setSaving(false);
    }
  }

  function result(icon: "ok" | "warn", title: string, text: React.ReactNode, actions?: React.ReactNode) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className={`pw-result-icon ${icon === "warn" ? "warn" : ""}`}>
              {icon === "warn" ? <FaTriangleExclamation /> : <FaCircleCheck />}
            </span>
            <h1 className="pw-result-title">{title}</h1>
            <p className="pw-result-text">{text}</p>
            {actions && <div className="pw-result-actions">{actions}</div>}
          </div>
        </div>
      </div>
    );
  }

  const toBooking = (
    <Link className="adm-btn adm-btn-primary" to="/Appointment">
      Pedir otro turno
    </Link>
  );

  if (!token) return result("warn", "Este link no sirve", "Le falta la parte que identifica tu turno. Puede que se haya cortado al copiarlo del mail.");
  if (error) return result("warn", "No pudimos abrir tu turno", error);

  if (!view) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-head">
            <h1 className="pw-title">Tu turno</h1>
            <p className="pw-subtitle">Un segundo, lo estamos buscando.</p>
          </div>
        </div>
      </div>
    );
  }

  const who = `${view.professional.name} ${view.professional.surname}`;
  const when = `${formatDayLabel(appointmentDate(view.date))}, de ${view.initialHour} a ${view.finalHour}`;

  if (answered === "yes") return result("ok", "¡Gracias por avisar!", `${who} ya sabe que vas. ${when}.`);
  if (answered === "no" || view.status === "cancelled")
    return result(
      "ok",
      answered === "no" ? "Listo, cancelamos tu turno" : "Este turno está cancelado",
      answered === "no" ? "Gracias por avisar con tiempo. El horario queda libre para otra persona." : `Era ${when}, con ${who}.`,
      toBooking
    );
  if (view.status === "assisted" || view.status === "missed") return result("warn", "Este turno ya pasó", `Era ${when}, con ${who}.`);

  return (
    <div className="pw-page">
      <div className="pw-card">
        <div className="pw-head">
          <h1 className="pw-title">¿Vas a poder venir?</h1>
          <p className="pw-subtitle">Contestá con un toque, así {view.professional.name} sabe con tiempo quién viene.</p>
        </div>

        <div className="ui-detail-list attendance-facts">
          <div className="ui-detail-row">
            <span>Cuándo</span>
            <strong>{when}</strong>
          </div>
          <div className="ui-detail-row">
            <span>Con quién</span>
            <strong>
              {who}
              {view.professional.speciality ? ` · ${view.professional.speciality}` : ""}
            </strong>
          </div>
          {view.room && (
            <div className="ui-detail-row">
              <span>Dónde</span>
              <strong>{view.room} · 9 de Julio 3672</strong>
            </div>
          )}
        </div>

        {view.confirmedAt && !confirmingNo && <p className="ui-alert ui-alert-info">Ya nos avisaste que venís. Si cambió algo, podés cancelarlo acá.</p>}

        {confirmingNo ? (
          <>
            <p className="ui-alert ui-alert-warn">
              Si no vas a poder ir, tu turno se cancela y el horario queda libre para otra persona.
            </p>
            <div className="pw-result-actions">
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => answer("no")} disabled={saving}>
                {saving ? "Cancelando…" : "Sí, cancelar mi turno"}
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingNo(false)} disabled={saving}>
                Volver
              </button>
            </div>
          </>
        ) : (
          <div className="pw-result-actions">
            {view.status === "accepted" && !view.confirmedAt && (
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => answer("yes")} disabled={saving}>
                {saving ? "Guardando…" : "Sí, voy"}
              </button>
            )}
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingNo(true)} disabled={saving}>
              No puedo ir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
