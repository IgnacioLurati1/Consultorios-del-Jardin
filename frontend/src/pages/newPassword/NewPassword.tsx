import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { FaCircleCheck, FaEye, FaEyeSlash, FaRegCircle, FaTriangleExclamation } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { useLogo } from "../../lib/useLogo";
import "./passwordPages.css";

/** Mismo mínimo que pide el registro. */
const MIN_PASSWORD = 6;

export function NewPassword() {
  const logo = useLogo();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules = useMemo(
    () => [
      { label: `Al menos ${MIN_PASSWORD} caracteres`, done: password.length >= MIN_PASSWORD },
      { label: "Las dos coinciden", done: password.length > 0 && password === confirm },
    ],
    [password, confirm]
  );

  const ready = rules.every((rule) => rule.done);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !token) return;

    setError(null);
    setSaving(true);

    // No va por `api`: su interceptor pone el token de la sesión en el header, y acá
    // el que vale es el del link del mail. Son dos tokens distintos.
    axios
      .patch(
        "/api/people/changePassword",
        { password },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      )
      .then(() => setDone(true))
      .catch((err) =>
        setError(err.response?.data?.message || "No pudimos cambiar la contraseña. Probá de nuevo en un rato")
      )
      .finally(() => setSaving(false));
  }

  // Entrar a mano a /reset-password, o con un link cortado por el cliente de correo.
  if (!token) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon warn">
              <FaTriangleExclamation />
            </span>
            <h1 className="pw-result-title">Este link no sirve</h1>
            <p className="pw-result-text">
              Le falta la parte que identifica tu pedido. Puede que se haya cortado al copiarlo desde el mail.
            </p>
            <div className="pw-result-actions">
              <Link className="adm-btn adm-btn-primary" to="/forgot-password">
                Pedir un link nuevo
              </Link>
            </div>
          </div>
        </div>
        <Toasts />
      </div>
    );
  }

  if (done) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon">
              <FaCircleCheck />
            </span>
            <h1 className="pw-result-title">Contraseña cambiada</h1>
            <p className="pw-result-text">Ya podés entrar con la nueva. El link del mail dejó de servir.</p>
            <div className="pw-result-actions">
              <Link className="adm-btn adm-btn-primary" to="/Login">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
        <Toasts />
      </div>
    );
  }

  return (
    <div className="pw-page">
      <form className="pw-card" onSubmit={submit} noValidate>
        <div className="pw-head">
          <img src={logo} alt="Consultorios del Jardín" className="pw-logo" />
          <h1 className="pw-title">Elegí tu contraseña nueva</h1>
          <p className="pw-subtitle">La vas a usar para entrar a partir de ahora.</p>
        </div>

        <div className="pw-body">
          <label className="ui-field">
            <span>Contraseña nueva</span>
            <div className="pw-input-wrap">
              <input
                autoFocus
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                className="pw-input-toggle"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Ocultar" : "Mostrar"}
              >
                {visible ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <label className="ui-field">
            <span>Repetila</span>
            <div className="pw-input-wrap">
              <input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </label>

          <ul className="pw-rules">
            {rules.map((rule) => (
              <li key={rule.label} className={`pw-rule ${rule.done ? "done" : ""}`}>
                {rule.done ? <FaCircleCheck /> : <FaRegCircle />}
                {rule.label}
              </li>
            ))}
          </ul>

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>

        <button type="submit" className="adm-btn adm-btn-primary pw-submit" disabled={!ready || saving}>
          {saving ? "Guardando…" : "Guardar contraseña"}
        </button>

        <p className="pw-foot">
          ¿Venciste el link? <Link to="/forgot-password">Pedí uno nuevo</Link>
        </p>
      </form>

      <Toasts />
    </div>
  );
}
