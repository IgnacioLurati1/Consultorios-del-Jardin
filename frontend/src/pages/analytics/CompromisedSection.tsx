import { useEffect, useState } from "react";
import { FaShieldHalved } from "react-icons/fa6";
import { AnalyticsSection } from "./Kpi.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { Hint } from "../../components/hint/Hint.tsx";
import { findCompromisedAccounts, type CompromisedAccount, type CompromisedReport } from "./compromisedService.ts";

/** "2026-09-02T02:14:00Z" → "2 de sep, 02:14". La hora importa más que la fecha acá. */
function when(iso: string | null): string {
  if (!iso) return "sin fecha";

  const date = new Date(iso);
  return `${date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const ROLE: Record<string, string> = {
  admin: "Administración",
  professional: "Profesional",
  client: "Paciente",
};

/** Un 403 es un intento que rebotó; un 200 es algo que efectivamente pasó. */
function outcome(status: number | null): { label: string; className: string } {
  if (status === null) return { label: "sin registrar", className: "cmp-step-unknown" };
  if (status >= 200 && status < 300) return { label: "salió bien", className: "cmp-step-done" };
  if (status === 401 || status === 403) return { label: "rebotó", className: "cmp-step-blocked" };
  return { label: `error ${status}`, className: "cmp-step-failed" };
}

/**
 * Las cuentas que el sistema cerró por parecer estar en manos de otra persona.
 *
 * Lo importante de esta pantalla no es la lista sino el rastro. Que una cuenta se haya
 * cerrado no le dice nada a nadie: lo que hay que poder ver es qué llegó a tocar antes de
 * caer, porque de eso dependen las dos decisiones que siguen —si se la vuelve a habilitar
 * y si hay algo que reparar—. Cada paso dice además si salió o si rebotó, que es la
 * diferencia entre un daño y un intento.
 */
export function CompromisedSection() {
  const [report, setReport] = useState<CompromisedReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    findCompromisedAccounts()
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  if (!report) {
    return (
      <AnalyticsSection title="Cuentas cerradas por seguridad">
        <SkeletonLine height={18} />
        <SkeletonLine width="55%" height={18} />
      </AnalyticsSection>
    );
  }

  const { accounts, rules } = report;

  return (
    <AnalyticsSection title="Cuentas cerradas por seguridad" scope="al día de hoy">
      <p className="an-note">
        Una cuenta se cierra sola cuando toca cuentas o datos de otras personas a una velocidad que no es de nadie
        —{rules.burst.admin} puntos en {rules.burstSeconds} segundos para administración, {rules.burst.professional} para un
        profesional, {rules.burst.client} para un paciente— o cuando lo hace entre las{" "}
        {String(rules.nightFrom).padStart(2, "0")} y las {String(rules.nightTo).padStart(2, "0")} con el consultorio cerrado.
        La persona recibe un mail y solo otro administrador puede volver a habilitarla.
      </p>

      {accounts.length === 0 ? (
        <p className="an-note">Ninguna cuenta se comportó así hasta ahora.</p>
      ) : (
        <ul className="cmp-list">
          {accounts.map((account) => (
            <Account
              key={account.email}
              account={account}
              open={open === account.email}
              onToggle={() => setOpen(open === account.email ? null : account.email)}
            />
          ))}
        </ul>
      )}
    </AnalyticsSection>
  );
}

function Account({ account, open, onToggle }: { account: CompromisedAccount; open: boolean; onToggle: () => void }) {
  const done = account.trail.filter((step) => step.status !== null && step.status >= 200 && step.status < 300).length;

  return (
    <li className={account.active ? "cmp-item cmp-item-warn" : "cmp-item"}>
      <div className="cmp-head">
        <span className="cmp-icon" aria-hidden="true">
          <FaShieldHalved />
        </span>

        <div className="cmp-who">
          <strong>
            {account.surname}, {account.name}
          </strong>
          <span>
            {account.email} · {ROLE[account.type] ?? account.type} · {when(account.bannedAt)}
          </span>
        </div>

        <span className="cmp-state">
          {account.active ? (
            <Hint text="Es la única cuenta de administración activa. Cerrarla dejaría el sistema sin nadie que pueda volver a abrir nada, así que quedó marcada y con el acceso abierto: revisala a mano.">
              <span className="adm-badge adm-badge-amber">Marcada, sin cerrar</span>
            </Hint>
          ) : (
            <span className="adm-badge adm-badge-red">Acceso cerrado</span>
          )}
        </span>
      </div>

      <p className="cmp-reason">{account.reason ?? "Sin motivo registrado"}</p>

      {account.trail.length > 0 && (
        <>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" aria-expanded={open} onClick={onToggle}>
            {open ? "Ocultar lo que tocó" : `Ver lo que tocó (${account.trail.length}, ${done} salieron)`}
          </button>

          {open && (
            <ol className="cmp-trail">
              {account.trail.map((step, index) => {
                const result = outcome(step.status);

                return (
                  <li key={`${step.at}-${index}`} className="cmp-step">
                    <span className="cmp-step-when">{when(step.at)}</span>
                    <span className="cmp-step-what">
                      {step.label}
                      <code>
                        {step.method} {decodeURIComponent(step.path)}
                      </code>
                    </span>
                    <span className={`cmp-step-result ${result.className}`}>{result.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </li>
  );
}
