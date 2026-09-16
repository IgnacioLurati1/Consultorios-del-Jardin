import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { findProfessionalPasswords, sendPasswordMails, type ProfessionalPassword } from "./usersService";
import "./passwordLinks.css";

/** "2026-09-12T..." → "12 de septiembre". El año solo si no es el de hoy. */
function shortDay(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * Mandarles a los profesionales el mail para cambiar la contraseña.
 *
 * Los administradores les dieron contraseñas provisorias, y esta ventana es para ver quién
 * ya la cambió y pedírselo al resto. Trae a todos los habilitados con su último cambio de
 * contraseña. El mail es el de "¿Olvidaste tu contraseña?", aclarando
 * que lo manda la administración.
 *
 * Nadie viene marcado: mandar un mail a un profesional es algo que se elige, no algo que
 * se desmarca. Para el caso de siempre está el atajo de marcar a los que no la cambiaron.
 *
 * Los cambios se anotan desde el 16 de septiembre de 2026. Uno anterior no dejó rastro y
 * figura como sin cambio.
 */
export function PasswordLinksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<ProfessionalPassword[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true;

    setRows(null);
    setError(null);
    setSelected(new Set());
    findProfessionalPasswords()
      .then((list) => current && setRows(list))
      .catch((problem: Error) => current && setError(problem.message));

    return () => {
      current = false;
    };
  }, [open]);

  // Primero los que no la cambiaron, que son a los que hay que escribirles.
  const sorted = useMemo(
    () => [...(rows ?? [])].sort((a, b) => Number(!!a.passwordChangedAt) - Number(!!b.passwordChangedAt)),
    [rows]
  );
  const unchanged = sorted.filter((row) => !row.passwordChangedAt);

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);

    try {
      const result = await sendPasswordMails([...selected]);

      if (result.sent.length > 0)
        toast.success(result.sent.length === 1 ? "Mail enviado a 1 profesional" : `Mails enviados a ${result.sent.length} profesionales`);
      if (result.failed.length > 0) {
        setError(`No salió el mail a ${result.failed.join(", ")}. Probá de nuevo en un rato.`);
        setSelected(new Set(result.failed));
        return;
      }
      onClose();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const count = selected.size;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title="Cambio de contraseña"
      subtitle="Profesionales habilitados"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={send} disabled={busy || count === 0}>
            {busy ? "Enviando…" : count === 1 ? "Mandar 1 mail" : `Mandar ${count} mails`}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <p className="adm-confirm-note">
          Cada uno recibe el mail para cambiar su contraseña, enviado por la administración. El link vale por seis meses y
          sirve una sola vez. Los cambios anteriores al 16 de septiembre no quedaron registrados.
        </p>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}

        {!rows ? (
          !error && <SkeletonList rows={4} />
        ) : rows.length === 0 ? (
          <p className="adm-confirm-note">Todavía no hay profesionales habilitados.</p>
        ) : (
          <>
            <div className="pwl-actions">
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => setSelected(new Set(unchanged.map((row) => row.email)))}
                disabled={busy || unchanged.length === 0}
              >
                {unchanged.length === 1 ? "Marcar al que no la cambió" : `Marcar los ${unchanged.length} que no la cambiaron`}
              </button>
              {count > 0 && (
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setSelected(new Set())} disabled={busy}>
                  Desmarcar todos
                </button>
              )}
            </div>

            <ul className="pwl-list">
              {sorted.map((row) => (
                <li key={row.email} className={selected.has(row.email) ? "" : "off"}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(row.email)}
                      onChange={() => toggle(row.email)}
                      disabled={busy}
                    />
                    <span className="pwl-who">
                      <strong>
                        {row.surname}, {row.name}
                      </strong>
                      <span>
                        {row.email}
                        {row.speciality ? ` · ${row.speciality}` : ""}
                      </span>
                    </span>
                    <span className={`pwl-access ${row.passwordChangedAt ? "" : "pwl-pending"}`}>
                      {row.passwordChangedAt ? `Cambió la contraseña el ${shortDay(row.passwordChangedAt)}` : "Sin cambio de contraseña"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
