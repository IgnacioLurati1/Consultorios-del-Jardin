import { Kpi, KpiGrid, AnalyticsSection } from "./Kpi.tsx";
import type { AccessChannels } from "./analyticsService.ts";

const ROLE_LABELS: Record<string, string> = {
  client: "Pacientes",
  professional: "Profesionales",
  admin: "Administración",
};

/**
 * Las cuatro situaciones posibles de una cuenta. Suman el total, así que la barra se
 * lee como el reparto completo y no como cuatro números sueltos.
 */
const SEGMENTS = [
  { key: "onlyApp", label: "Solo la app", color: "#3b7658" },
  { key: "both", label: "Las dos", color: "#6c788e" },
  { key: "onlyWeb", label: "Solo la página", color: "#9db8ab" },
  { key: "unknown", label: "Sin registro", color: "#cbd5e1" },
] as const;

/** "2026-08-12T..." → "12 de agosto de 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Por dónde entra la gente al sistema.
 *
 * Contesta si la app se usa o quedó abandonada, que es la pregunta que aparece cuando se
 * mantienen dos clientes. Los que usan las dos van aparte a propósito: son los que
 * notarían si una de las dos deja de estar al día con la otra.
 *
 * El dato se anota cuando alguien inicia sesión o renueva su sesión, así que solo habla
 * de lo que pasó desde que se empezó a medir. Eso se dice en pantalla: un "sin registro"
 * alto el primer mes no significa que esas cuentas no se usen.
 */
export function AccessChannelsSection({ channels }: { channels: AccessChannels }) {
  const { accounts, withAccess, onlyApp, onlyWeb, both, unknown } = channels;

  if (accounts === 0) return null;

  const share = (value: number) => `${Math.round((value / accounts) * 100)}%`;

  return (
    <AnalyticsSection title="Por dónde entran" scope={channels.since ? `desde el ${longDate(channels.since)}` : undefined}>
      <p className="an-note">
        Se anota cada vez que alguien inicia sesión o vuelve a entrar. Las cuentas "sin registro" no son cuentas
        muertas: son las que no entraron desde que se empezó a medir.
      </p>

      <KpiGrid>
        <Kpi
          lead
          label="Usan la app"
          value={channels.app}
          note={both > 0 ? `${onlyApp} entran solo por acá` : "sobre las cuentas que entraron"}
        />
        <Kpi
          label="Usan la página"
          value={channels.web}
          note={both > 0 ? `${onlyWeb} entran solo por acá` : "sobre las cuentas que entraron"}
        />
        <Kpi label="Usan las dos" value={both} note={`de ${withAccess} que entraron alguna vez`} />
        <Kpi
          label="Sin registro"
          value={unknown}
          note={unknown === 0 ? "todas las cuentas entraron alguna vez" : `de ${accounts} cuentas con acceso`}
        />
      </KpiGrid>

      <div className="adm-panel an-tools-panel">
        <h3 className="an-tools-title">Cómo se reparten las {accounts} cuentas</h3>

        <div className="an-split" role="img" aria-label={SEGMENTS.map((s) => `${s.label}: ${channels[s.key]}`).join(", ")}>
          {SEGMENTS.filter((segment) => channels[segment.key] > 0).map((segment) => (
            <span
              key={segment.key}
              className="an-split-seg"
              style={{ width: share(channels[segment.key]), background: segment.color }}
            />
          ))}
        </div>

        <ul className="an-legend">
          {SEGMENTS.map((segment) => (
            <li key={segment.key}>
              <span className="an-legend-swatch" style={{ background: segment.color }} />
              {segment.label}: <strong>{channels[segment.key]}</strong>
            </li>
          ))}
        </ul>

        {channels.byRole.length > 1 && (
          <ul className="an-tools an-roles">
            {channels.byRole.map((row) => (
              <li key={row.role} className="an-tool">
                <span className="an-tool-name">{ROLE_LABELS[row.role] ?? row.role}</span>
                <span className="an-tool-bar" aria-hidden="true">
                  {SEGMENTS.filter((segment) => row[segment.key] > 0).map((segment) => (
                    <span
                      key={segment.key}
                      className="an-split-seg"
                      style={{
                        width: `${Math.round((row[segment.key] / (row.onlyApp + row.onlyWeb + row.both + row.unknown)) * 100)}%`,
                        background: segment.color,
                      }}
                    />
                  ))}
                </span>
                <span className="an-tool-count">{row.onlyApp + row.onlyWeb + row.both + row.unknown}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AnalyticsSection>
  );
}
