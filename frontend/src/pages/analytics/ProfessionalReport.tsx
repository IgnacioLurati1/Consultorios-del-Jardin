import { useState } from "react";
import { StackedBars, ChartLegend, type Band } from "./Charts.tsx";
import { Kpi, KpiGrid, AnalyticsSection, MonthTabs } from "./Kpi.tsx";
import { decimal, money, type ProfessionalAnalytics } from "./analyticsService.ts";

const BILLING_BANDS: Band[] = [
  { key: "billed", label: "Cobrado (turnos asistidos)", color: "#3b7658" },
  { key: "scheduled", label: "Agendado sin cerrar", color: "#9db8ab", hatched: true },
];

const APPOINTMENT_BANDS: Band[] = [
  { key: "assisted", label: "Asistieron", color: "#3b7658" },
  { key: "missed", label: "No vinieron", color: "#b7791f" },
  { key: "cancelled", label: "Cancelados", color: "#c0392b" },
];

/**
 * Los números de un profesional. Lo comparten su propio panel y el del admin cuando
 * mira a alguien en particular, así los dos leen exactamente lo mismo.
 */
export function ProfessionalReport({ data }: { data: ProfessionalAnalytics }) {
  const { recent, total, months } = data;

  const [monthKey, setMonthKey] = useState(recent[0].key);
  const month = recent.find((item) => item.key === monthKey) ?? recent[0];

  // Sobre todos los turnos que se dieron, cancelados incluidos: es el denominador que
  // hace que el porcentaje signifique "de cada 100 turnos que di, tantos se cayeron".
  const billingColumns = months.map((month) => ({
    label: shortMonth(month.label),
    values: [month.billed, month.scheduled],
  }));

  const appointmentColumns = months.map((month) => ({
    label: shortMonth(month.label),
    values: [month.assisted, month.missed, month.cancelled],
  }));

  const given = total.appointments + total.cancelled;
  const lost = total.cancelled + total.missed;
  const lostRate = given === 0 ? 0 : Math.round((lost / given) * 100);

  return (
    <>
      <AnalyticsSection
        title="Por mes"
        scope={month.inProgress ? "en curso, hasta hoy" : "mes cerrado"}
        actions={<MonthTabs months={recent} selected={month.key} onSelect={setMonthKey} />}
      >
        <KpiGrid>
          <Kpi
            lead
            label="Cobrado"
            value={money(month.billed)}
            note={
              month.scheduled > 0 ? (
                <>
                  <span className="an-muted">{money(month.scheduled)}</span> agendados sin cerrar
                </>
              ) : (
                "de los turnos marcados como asistidos"
              )
            }
          />
          <Kpi label="Pacientes" value={month.patients} note={`${month.appointments} turnos en pie`} />
          <Kpi
            label="Cancelados o ausentes"
            value={month.cancelled + month.missed}
            note={`${month.cancelled} cancelados · ${month.missed} no vinieron`}
          />
          <Kpi label="Sobreturnos" value={month.overbooked} note="dados fuera de tus módulos" />
        </KpiGrid>
      </AnalyticsSection>

      <AnalyticsSection title="Facturación" scope={`Últimos ${total.months} meses cerrados`}>
        <p className="an-note">
          El mes en curso no entra en los gráficos hasta que termine
        </p>
        <StackedBars
          bands={BILLING_BANDS}
          columns={billingColumns}
          format={(value) => money(value)}
          empty="Todavía no hay meses cerrados con turnos cobrados."
        />
        <ChartLegend bands={BILLING_BANDS} columns={billingColumns} />
      </AnalyticsSection>

      <AnalyticsSection title="Turnos por mes" scope={`Últimos ${total.months} meses cerrados`}>
        <StackedBars
          bands={APPOINTMENT_BANDS}
          columns={appointmentColumns}
          format={(value) => String(Math.round(value))}
          empty="Todavía no hay meses cerrados con turnos."
        />
        <ChartLegend bands={APPOINTMENT_BANDS} columns={appointmentColumns} />
      </AnalyticsSection>

      <AnalyticsSection title="Acumulado" scope={`Últimos ${total.months} meses cerrados`}>
        <KpiGrid>
          <Kpi lead label="Cobrado" value={money(total.billed)} note={`${total.assisted} turnos asistidos`} />
          <Kpi label="Pacientes distintos" value={total.patients} />
          <Kpi label="Cancelados o ausentes" value={lost} note={`${lostRate}% de los ${given} turnos dados`} />
          <Kpi label="Sobreturnos" value={total.overbooked} />
          <Kpi
            label="Turnos sacados por la app"
            value={total.fromApp}
            note={
              total.unknownOrigin > 0
                ? `${total.unknownOrigin} turnos sin dato de origen`
                : `${total.fromProfessional} los cargaste vos`
            }
          />
          <Kpi
            label="Turnos por día"
            value={decimal(total.averagePerDay)}
            note={
              total.busiestDay
                ? `el ${total.busiestDay} es el más cargado, con ${decimal(total.busiestDayAverage)}`
                : "sobre los días que atendiste"
            }
          />
        </KpiGrid>
      </AnalyticsSection>
    </>
  );
}

/** "agosto 2026" no entra bajo una barra: en el eje va "ago 26". */
function shortMonth(label: string): string {
  const [name, year] = label.split(" ");
  return `${name.slice(0, 3)} ${year.slice(2)}`;
}
