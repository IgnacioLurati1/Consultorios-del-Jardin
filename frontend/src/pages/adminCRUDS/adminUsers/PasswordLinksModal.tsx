import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { findPendingPasswords, resendPasswordLinks, type PendingPassword } from "./usersService";
import "./passwordLinks.css";

/** "2026-09-12T..." → "12 de septiembre". */
function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

/**
 * Mandarles el link para elegir la contraseña a los profesionales que no la eligieron.
 *
 * La lista la arma el servidor: habilitados y sin contraseña propia. Los que se dieron de
 * alta antes del link nunca lo recibieron, y los que ya la eligieron —por el link o por
 * "¿Olvidaste tu contraseña?"— no aparecen.
 *
 * Quien nunca entró va marcado. Quien ya entra con la contraseña que le dieron va sin
 * marcar: el mail le puede servir o confundirlo, y eso lo decide el administrador.
 */
export function PasswordLinksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<PendingPassword[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true;

    setRows(null);
    setError(null);
    findPendingPasswords()
      .then((list) => {
        if (!current) return;
        setRows(list);
        setSelected(new Set(list.filter((row) => !row.lastAccess).map((row) => row.email)));
      })
      .catch((problem: Error) => current && setError(problem.message));

    return () => {
      current = false;
    };
  }, [open]);

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
      const result = await resendPasswordLinks([...selected]);

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
      title="Link para elegir la contraseña"
      subtitle="Profesionales que todavía no eligieron la suya"
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
          Cada uno recibe un link para crear su contraseña. Vence en 7 días y sirve una sola vez. Quien ya entra con la
          contraseña que le dieron va sin marcar.
        </p>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}

        {!rows ? (
          !error && <SkeletonList rows={4} />
        ) : rows.length === 0 ? (
          <p className="adm-confirm-note">Todos los profesionales ya eligieron su contraseña.</p>
        ) : (
          <ul className="pwl-list">
            {rows.map((row) => (
              <li key={row.email} className={selected.has(row.email) ? "" : "off"}>
                <label>
                  <input type="checkbox" checked={selected.has(row.email)} onChange={() => toggle(row.email)} disabled={busy} />
                  <span className="pwl-who">
                    <strong>
                      {row.surname}, {row.name}
                    </strong>
                    <span>
                      {row.email}
                      {row.speciality ? ` · ${row.speciality}` : ""}
                    </span>
                  </span>
                  <span className="pwl-access">
                    {row.lastAccess ? `Entró el ${shortDay(row.lastAccess)}` : "Nunca entró"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
