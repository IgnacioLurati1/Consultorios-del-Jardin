import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { findMyWaitlist, messageOf, removeFromMyWaitlist, type WaitingPatient } from "./waitlistService.ts";
import { describeDaysTitle, formatMoment } from "./waitlistRules.ts";

interface WaitlistPeopleModalProps {
  open: boolean;
  onClose: () => void;
  /** Cómo quedó la lista después de sacar a alguien, para que la pantalla de atrás se entere. */
  onChanged?: (list: WaitingPatient[]) => void;
}

/**
 * Quiénes esperan al profesional, con la opción de sacar a alguien.
 *
 * Se abre desde su panel y desde sus números. Sacar a alguien no le avisa a la persona: es
 * una decisión de la agenda del profesional y contársela no le deja nada para hacer.
 */
export function WaitlistPeopleModal({ open, onClose, onChanged }: WaitlistPeopleModalProps) {
  const [list, setList] = useState<WaitingPatient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!open) return;

    let vigente = true;
    setList(null);
    setError(null);
    setConfirming(null);

    findMyWaitlist()
      .then((data) => {
        if (vigente) setList(data);
      })
      .catch((err) => {
        if (vigente) setError(err.message);
      });

    return () => {
      vigente = false;
    };
  }, [open]);

  async function remove(person: WaitingPatient) {
    setRemoving(true);

    try {
      await removeFromMyWaitlist(person.id);
      const next = (list ?? []).filter((item) => item.id !== person.id);
      setList(next);
      setConfirming(null);
      onChanged?.(next);
      toast.success(`${person.patient.name} fuera de la lista de espera`);
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setRemoving(false);
    }
  }

  const count = list?.length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lista de espera"
      subtitle={
        list === null ? undefined : count === 0 ? "Sin personas en espera" : count === 1 ? "Una persona en espera" : `${count} personas en espera`
      }
      footer={
        <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {error ? (
        <p className="ui-alert ui-alert-error">Error al cargar la lista de espera. {error}</p>
      ) : list === null ? (
        <SkeletonList rows={3} />
      ) : count === 0 ? (
        <div className="adm-empty">Sin personas en espera.</div>
      ) : (
        <>
          <ul className="waitlist-people">
            {list.map((person) => (
              <li key={person.id} className="waitlist-person">
                <div className="waitlist-person-main">
                  <strong>
                    {person.patient.surname}, {person.patient.name}
                  </strong>
                  <span className="waitlist-person-when">
                    {describeDaysTitle(person.days)}, de {person.fromHour} a {person.toHour}
                  </span>
                  <span className="waitlist-person-meta">
                    Se anotó el {formatMoment(person.createdAt)} ·{" "}
                    {person.noticesSent === 0
                      ? "todavía sin avisos"
                      : person.noticesSent === 1
                        ? "un aviso"
                        : `${person.noticesSent} avisos`}{" "}
                    · sale el {formatMoment(person.expiresAt)}
                  </span>
                </div>

                {confirming === person.id ? (
                  <div className="waitlist-person-actions">
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setConfirming(null)}>
                      Volver
                    </button>
                    <button type="button" className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => remove(person)} disabled={removing}>
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setConfirming(person.id)}>
                    Quitar de la lista
                  </button>
                )}
              </li>
            ))}
          </ul>

          <p className="waitlist-fineprint">
            Al liberarse un horario de su franja, el aviso llega a todos a la vez y el turno queda para quien lo reserve
            primero. Quitar a alguien de la lista no le envía aviso.
          </p>
        </>
      )}
    </Modal>
  );
}
