import { useEffect, useState } from "react";
import { AnalyticsSection, Kpi, KpiGrid } from "./Kpi.tsx";
import { Hint } from "../../components/hint/Hint.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { explainSuspicion, findBehaviourReport, type BannedPatient, type BehaviourReport } from "./behaviourService.ts";

/** "2026-09-02T13:40:00Z" → "2 de sep, 13:40". */
function whenBanned(iso: string | null): string {
  if (!iso) return "sin fecha";

  const date = new Date(iso);
  return `${date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Qué pasó exactamente con una cuenta que se cayó sola, en una línea. */
function explainBanned(person: BannedPatient): string {
  const reason = person.reason ? person.reason.charAt(0).toLowerCase() + person.reason.slice(1) : "saltó uno de los límites";

  return (
    `El sistema la deshabilitó solo porque ${reason}. Los turnos de esa tanda se dieron de baja junto con la cuenta. ` +
    "La persona no puede entrar hasta que la vuelvas a habilitar desde Usuarios."
  );
}

/**
 * Cómo se está usando el sistema, y quién lo está usando mal.
 *
 * Va con los números del sistema y no con los del consultorio porque no habla de cómo
 * viene el mes: habla de cuentas, y de decisiones que solo puede tomar el admin. Son dos
 * listas de naturaleza muy distinta y por eso están separadas: la roja ya pasó —el
 * sistema actuó— y la amarilla no es una acusación, es un pedido de que alguien mire.
 */
export function BehaviourSection() {
  const [report, setReport] = useState<BehaviourReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    findBehaviourReport().then(setReport).catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  if (!report) {
    return (
      <AnalyticsSection title="Cuentas y comportamiento">
        <SkeletonLine height={18} />
        <SkeletonLine width="60%" height={18} />
      </AnalyticsSection>
    );
  }

  const { banned, suspicious, measured, rules } = report;

  return (
    <AnalyticsSection title="Cuentas y comportamiento" scope="al día de hoy">
      <p className="an-note">
        El sistema deshabilita solo a quien saca más de {rules.burstLimit} turnos en un minuto o llega a {rules.dailyLimit} en
        el mismo día, y le da de baja esos turnos. Aparte marca —sin ninguna consecuencia— a quien asistió a menos del{" "}
        {rules.ratePercent}% de sus turnos cerrados teniendo al menos {rules.minMissed} ausencias.
      </p>

      <KpiGrid>
        <Kpi
          lead
          label="Deshabilitados por el sistema"
          value={banned.length}
          note={banned.length === 0 ? "ninguno hasta ahora" : "los habilitás de nuevo desde Usuarios"}
        />
        <Kpi
          label="Comportamiento sospechoso"
          value={suspicious.length}
          note={`sobre ${measured} pacientes con turnos cerrados`}
        />
      </KpiGrid>

      {banned.length > 0 && (
        <div className="an-flags">
          <h3 className="an-flags-title an-flags-title-red">Los deshabilitó el sistema</h3>
          <ul className="an-flag-list">
            {banned.map((person) => (
              <li key={person.email} className="an-flag an-flag-red">
                <div className="an-flag-who">
                  <strong>
                    {person.surname}, {person.name}
                  </strong>
                  <span>{person.email}</span>
                </div>
                <div className="an-flag-why">
                  <Hint text={explainBanned(person)}>
                    <span>{person.reason ?? "Sin motivo registrado"}</span>
                  </Hint>
                  <span className="an-muted">{whenBanned(person.bannedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suspicious.length > 0 && (
        <div className="an-flags">
          <h3 className="an-flags-title an-flags-title-amber">Faltan más de lo que vienen</h3>
          <ul className="an-flag-list">
            {suspicious.map((patient) => (
              <li key={patient.email} className="an-flag an-flag-amber">
                <div className="an-flag-who">
                  <strong>
                    {patient.surname}, {patient.name}
                  </strong>
                  <span>{patient.email}</span>
                </div>
                <div className="an-flag-why">
                  <Hint text={explainSuspicion(patient)}>
                    <span>Asistió al {Math.round(patient.rate * 100)}% de sus turnos</span>
                  </Hint>
                  <span className="an-muted">
                    {patient.assisted} vinieron · {patient.missed} no
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {banned.length === 0 && suspicious.length === 0 && (
        <p className="an-note">Ninguna cuenta cayó en ninguna de las dos reglas.</p>
      )}
    </AnalyticsSection>
  );
}
