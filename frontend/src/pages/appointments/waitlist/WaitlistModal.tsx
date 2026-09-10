import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { SkeletonLine } from "../../../components/skeleton/Skeleton.tsx";
import type { Person } from "../../types.ts";
import { appointmentDate, formatDayLabel } from "../appointmentTypes.ts";
import { getWaitlistStatus, joinWaitlist, leaveWaitlist, messageOf, type WaitlistStatus } from "./waitlistService.ts";
import { WEEK_DAYS, blockReason, describeDays, describeDaysTitle, formatMoment, formProblem, hourOptions } from "./waitlistRules.ts";

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  professional: Person;
}

const HOURS = hourOptions();

/**
 * La lista de espera de un profesional, del lado del paciente.
 *
 * Es la misma ventana para anotarse y para volver a mirar: si ya está anotado, muestra en
 * qué quedó —hasta cuándo, cuántos avisos le llegaron y de qué horarios— y deja salir.
 *
 * El estado se pide cada vez que se abre, y otra vez justo antes de anotar. Anotarse más
 * veces de las que permite el mes cierra la cuenta, así que la pantalla no puede decidir
 * con lo que sabía hace un rato: con otra pestaña abierta, eso ya puede haber cambiado.
 */
export function WaitlistModal({ open, onClose, professional }: WaitlistModalProps) {
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [days, setDays] = useState<number[]>([]);
  const [fromHour, setFromHour] = useState("09:00");
  const [toHour, setToHour] = useState("13:00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Salir se pregunta: no devuelve la inscripción del mes. */
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  useEffect(() => {
    if (!open) return;

    let vigente = true;
    setStatus(null);
    setLoadError(null);
    setError(null);
    setConfirmingLeave(false);

    getWaitlistStatus(professional.email)
      .then((data) => {
        if (vigente) setStatus(data);
      })
      .catch((err) => {
        if (vigente) setLoadError(err.message);
      });

    return () => {
      vigente = false;
    };
  }, [open, professional.email, attempt]);

  const name = `${professional.surname}, ${professional.name}`;

  async function join() {
    if (!status) return;

    const problem = formProblem(days, fromHour, toHour, status.limits);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const fresh = await getWaitlistStatus(professional.email);

      // Algo cambió desde que se abrió la ventana: se muestra cómo quedó y no se manda nada.
      if (fresh.entry || blockReason(fresh)) {
        setStatus(fresh);
        return;
      }

      const entry = await joinWaitlist(professional.email, { days, fromHour, toHour });
      setStatus({ ...fresh, entry, active: [...fresh.active, entry.professional], monthUsed: fresh.monthUsed + 1 });
      toast.success("Quedaste en la lista de espera");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    setSaving(true);
    setError(null);

    try {
      await leaveWaitlist(professional.email);
      setStatus(await getWaitlistStatus(professional.email));
      setConfirmingLeave(false);
      toast.success("Saliste de la lista de espera");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const closeButton = (
    <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
      Cerrar
    </button>
  );

  let body: React.ReactNode;
  let footer: React.ReactNode = closeButton;

  if (loadError) {
    body = (
      <>
        <p className="ui-alert ui-alert-error">No pudimos consultar la lista de espera. {loadError}</p>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          Probar de nuevo
        </button>
      </>
    );
  } else if (!status) {
    body = (
      <div className="waitlist-loading">
        <SkeletonLine height={18} />
        <SkeletonLine width="70%" height={18} />
        <SkeletonLine width="45%" height={18} />
      </div>
    );
  } else if (status.entry) {
    const entry = status.entry;

    body = (
      <>
        <p className="ui-alert ui-alert-info">
          Estás en la lista de espera. Si alguien da de baja un turno que te sirve con más de un día de anticipación, te
          avisamos por mail y en la campanita.
        </p>

        <div className="ui-detail-list">
          <div className="ui-detail-row">
            <span>Días</span>
            <strong>{describeDaysTitle(entry.days)}</strong>
          </div>
          <div className="ui-detail-row">
            <span>Horario</span>
            <strong>
              De {entry.fromHour} a {entry.toHour}
            </strong>
          </div>
          <div className="ui-detail-row">
            <span>Anotado hasta el</span>
            <strong>{formatMoment(entry.expiresAt)}</strong>
          </div>
          <div className="ui-detail-row">
            <span>Avisos recibidos</span>
            <strong>
              {entry.noticesSent} de {status.limits.maxNotices}
            </strong>
          </div>
        </div>

        {entry.notices.length > 0 && (
          <div className="ui-section">
            <h3 className="ui-section-title">Los horarios que te avisamos</h3>
            <ul className="waitlist-notices">
              {entry.notices.map((notice) => (
                <li key={`${notice.date}-${notice.initialHour}`}>
                  {formatDayLabel(appointmentDate(notice.date))} a las {notice.initialHour}
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirmingLeave && (
          <p className="ui-alert ui-alert-warn">
            Si salís, dejamos de avisarte de los horarios de {professional.name}. Salir no te devuelve la inscripción de este mes.
          </p>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </>
    );

    footer = confirmingLeave ? (
      <>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingLeave(false)}>
          Volver
        </button>
        <button type="button" className="adm-btn adm-btn-danger" onClick={leave} disabled={saving}>
          {saving ? "Saliendo…" : "Sí, salir de la lista"}
        </button>
      </>
    ) : (
      <>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingLeave(true)}>
          Salir de la lista
        </button>
        <button type="button" className="adm-btn adm-btn-primary" onClick={onClose}>
          Listo
        </button>
      </>
    );
  } else {
    const reason = blockReason(status);

    if (reason) {
      const others = status.active.map((other) => `${other.surname}, ${other.name}`);

      body = (
        <>
          <p className="ui-alert ui-alert-warn">{reason}</p>
          {status.enabled && others.length > 0 && (
            <p className="waitlist-fineprint">
              {others.length === 1 ? `Ahora estás en la lista de ${others[0]}.` : `Ahora estás en las listas de ${others.join(" y de ")}.`}
            </p>
          )}
        </>
      );
    } else {
      const problem = formProblem(days, fromHour, toHour, status.limits);
      const remaining = status.limits.maxPerMonth - status.monthUsed;

      body = (
        <>
          <p className="waitlist-lead">
            Elegí qué días y en qué horario te sirve. Si alguien da de baja un turno que cae ahí con más de un día de
            anticipación, te avisamos por mail y en la campanita.
          </p>

          <div className="ui-field">
            <span>Días, hasta {status.limits.maxDays}</span>
            <div className="adm-chips waitlist-days" role="group" aria-label="Días que te sirven">
              {WEEK_DAYS.map((day) => {
                const on = days.includes(day.value);
                const topped = !on && days.length >= status.limits.maxDays;

                return (
                  <button
                    key={day.value}
                    type="button"
                    className={on ? "active" : ""}
                    aria-pressed={on}
                    disabled={topped}
                    onClick={() => {
                      setError(null);
                      setDays(on ? days.filter((value) => value !== day.value) : [...days, day.value].sort((a, b) => a - b));
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ui-field-row">
            <label className="ui-field">
              <span>Desde</span>
              <select value={fromHour} onChange={(e) => setFromHour(e.target.value)}>
                {HOURS.slice(0, -1).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span>Hasta</span>
              <select value={toHour} onChange={(e) => setToHour(e.target.value)}>
                {HOURS.slice(1).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <small>Hasta {status.limits.maxHours} horas.</small>
            </label>
          </div>

          <p className={`waitlist-summary ${problem ? "muted" : ""}`}>
            {problem ?? `Te avisamos si se libera un turno los ${describeDays(days)} entre las ${fromHour} y las ${toHour}.`}
          </p>

          <p className="waitlist-fineprint">
            Quedás anotado {status.limits.lifetimeDays} días o hasta recibir {status.limits.maxNotices} avisos. Les avisamos a
            todos los que esperan el mismo horario, así que se lo queda el primero que lo reserva.{" "}
            {remaining === 1 ? "Este mes te queda una inscripción." : `Este mes te quedan ${remaining} inscripciones.`}
          </p>

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </>
      );

      footer = (
        <>
          {closeButton}
          <button type="button" className="adm-btn adm-btn-primary" onClick={join} disabled={saving || !!problem}>
            {saving ? "Anotando…" : "Anotarme"}
          </button>
        </>
      );
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Lista de espera" subtitle={name} footer={footer}>
      {body}
    </Modal>
  );
}
