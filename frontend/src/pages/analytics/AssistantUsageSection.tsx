import { useEffect, useState } from "react";
import { Kpi, KpiGrid, AnalyticsSection } from "./Kpi.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { findAssistantUsage, type AssistantUsage } from "./analyticsService.ts";

/** Los tokens se cuentan de a miles: "1,2 M" se lee, "1.204.883" no. */
function tokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} k`;
  return String(value);
}

const ROLE_LABELS: Record<string, string> = {
  client: "Pacientes",
  professional: "Profesionales",
  admin: "Administración",
};

/**
 * Qué se le pide al asistente y cuánto sale.
 *
 * Los tokens son lo que factura el proveedor del modelo, así que es el único número que
 * se puede leer como plata. El primero es el del día porque el límite del plan gratuito
 * es diario: el del mes sirve para ver la tendencia, pero el que se puede agotar hoy es
 * el de hoy. El ranking de funciones está al lado a propósito: sirve para ver si lo que
 * más se usa es también lo que más cuesta.
 *
 * Carga aparte del resto de la pantalla: es información de otro sistema, y que tarde o
 * falle no tiene por qué demorar los números del consultorio.
 */
export function AssistantUsageSection() {
  const [data, setData] = useState<AssistantUsage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    findAssistantUsage()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  if (!data) {
    return (
      <AnalyticsSection title="El asistente" scope="Consumo y uso">
        <div className="prof-today-loading">
          <SkeletonLine height={20} />
          <SkeletonLine width="60%" height={20} />
        </div>
      </AnalyticsSection>
    );
  }

  if (data.historico.consultas === 0) {
    return (
      <AnalyticsSection title="El asistente" scope="Consumo y uso">
        <p className="an-muted">Todavía nadie le preguntó nada al asistente.</p>
      </AnalyticsSection>
    );
  }

  const top = data.herramientas.slice(0, 6);
  const most = top[0]?.count ?? 1;

  return (
    <AnalyticsSection title="El asistente" scope="Consumo y uso">
      <KpiGrid>
        {/* Del día y no del mes: el plan gratuito de Groq tiene un tope diario que se
            reinicia a medianoche, así que el número que dice si hoy se llega es este. */}
        <Kpi
          lead
          label="Tokens de hoy"
          value={tokens(data.hoy.tokens)}
          note={data.hoy.consultas === 1 ? "1 consulta hoy" : `${data.hoy.consultas} consultas hoy`}
        />
        <Kpi
          label="Tokens del mes"
          value={tokens(data.mesEnCurso.tokens)}
          note={`${data.mesEnCurso.consultas} consultas`}
        />
        <Kpi
          label="Tokens en total"
          value={tokens(data.historico.tokens)}
          note={`${data.historico.consultas} consultas desde que está`}
        />
        <Kpi
          label="Tokens por consulta"
          value={tokens(data.historico.tokensPorConsulta)}
          note={`${data.historico.llamadasAlModelo} llamadas al modelo`}
        />
        <Kpi
          label="Lo más pedido"
          value={data.masUsada ? data.masUsada.label : "—"}
          note={data.masUsada ? `${data.masUsada.count} veces` : "sin datos"}
        />
        <Kpi label="Personas que lo usaron" value={data.personasDistintas} />
        <Kpi
          label="Quién lo usa"
          value={ROLE_LABELS[data.porRol.slice().sort((a, b) => b.consultas - a.consultas)[0]?.role] ?? "—"}
          note={data.porRol.map((row) => `${ROLE_LABELS[row.role] ?? row.role}: ${row.consultas}`).join(" · ")}
        />
      </KpiGrid>

      <div className="adm-panel an-tools-panel">
        <h3 className="an-tools-title">Qué se le pide</h3>

        <ul className="an-tools">
          {top.map((tool) => (
            <li key={tool.name} className="an-tool">
              <span className="an-tool-name">{tool.label}</span>
              <span className="an-tool-bar" aria-hidden="true">
                <span className="an-tool-fill" style={{ width: `${Math.round((tool.count / most) * 100)}%` }} />
              </span>
              <span className="an-tool-count">{tool.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </AnalyticsSection>
  );
}
