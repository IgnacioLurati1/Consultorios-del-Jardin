import { useState } from "react";
import { StackedBars, ChartLegend, type Band } from "./Charts.tsx";
import { Kpi, KpiGrid, AnalyticsSection, MonthTabs } from "./Kpi.tsx";
import { decimal, money, type Denials, type ProfessionalAnalytics } from "./analyticsService.ts";

const BILLING_BANDS: Band[] = [
  { key: "billed", label: "Cobrado", color: "#3b7658" },
  { key: "scheduled", label: "Agendado sin cobrar", color: "#9db8ab", hatched: true },
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

  // La plata llega solo cuando el profesional mira lo suyo. Al admin el backend se la
  // saca, y esa ausencia es la que decide acá: no hace falta que nadie avise quién mira.
  const showsBilling = total.billed !== undefined;

  const billingColumns = months.map((month) => ({
    label: shortMonth(month.label),
    values: [month.billed ?? 0, month.scheduled ?? 0],
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
          {showsBilling ? (
            <Kpi
              lead
              label="Cobrado"
              value={money(month.billed ?? 0)}
              note={
                (month.scheduled ?? 0) > 0 ? (
                  <>
                    <span className="an-muted">{money(month.scheduled ?? 0)}</span> por cobrar de lo agendado
                  </>
                ) : (
                  "de los turnos que ya cobraste"
                )
              }
            />
          ) : (
            <Kpi
              lead
              label="Turnos en pie"
              value={month.appointments}
              note={`${month.assisted} ya asistidos`}
            />
          )}
          <Kpi
            label="Pacientes"
            value={month.patients}
            note={showsBilling ? `${month.appointments} turnos en pie` : "distintos en el mes"}
          />
          <Kpi
            label="Cancelados o ausentes"
            value={month.cancelled + month.missed}
            note={`${month.cancelled} cancelados · ${month.missed} no vinieron`}
          />
          {/* Lo que quedó sin cobrar de este mes. Va en rojo solo cuando hay algo que
              cobrar: un cero en rojo asusta sin motivo, y si todas las tarjetas gritan,
              ninguna grita. Como la facturación, el administrador no la ve. */}
          {month.debt && (
            <Kpi
              label="Te quedaron debiendo"
              value={money(month.debt.amount)}
              tone={month.debt.amount > 0 ? "danger" : undefined}
              note={
                month.debt.appointments === 0
                  ? "cobraste todo lo que atendiste"
                  : `${month.debt.appointments} ${month.debt.appointments === 1 ? "turno" : "turnos"} · ${
                      month.debt.people
                    } ${month.debt.people === 1 ? "persona" : "personas"}`
              }
            />
          )}
          <Kpi label="Sobreturnos" value={month.overbooked} note="dados fuera de tus módulos" />
          <Kpi label="Pedidos rechazados" value={month.denials.denied} note={splitOf(month.denials)} />
        </KpiGrid>
      </AnalyticsSection>

      {showsBilling ? (
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
      ) : null}

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
          {showsBilling ? (
            <Kpi lead label="Cobrado" value={money(total.billed ?? 0)} note="pagos completos y parciales, se hayan atendido o no" />
          ) : (
            <Kpi lead label="Turnos asistidos" value={total.assisted} note={`${total.appointments} turnos en pie`} />
          )}
          <Kpi label="Pacientes distintos" value={total.patients} />
          {/* Solo cuando el profesional mira lo suyo: quién le debe es plata suya con sus
              pacientes, igual que lo cobrado. El backend directamente no lo manda cuando
              el que mira es un administrador. */}
          {data.debt && (
            <Kpi
              label="Te quedaron debiendo"
              value={data.debt.people}
              note={
                data.debt.people === 0
                  ? "nadie te debe un turno"
                  : `${data.debt.people === 1 ? "persona" : "personas"} · ${data.debt.appointments} ${
                      data.debt.appointments === 1 ? "turno" : "turnos"
                    } por ${money(data.debt.amount)}`
              }
            />
          )}
          <Kpi label="Cancelados o ausentes" value={lost} note={`${lostRate}% de los ${given} turnos dados`} />
          <Kpi label="Sobreturnos" value={total.overbooked} />
          <Kpi label="Pedidos rechazados" value={total.denials.denied} note={splitOf(total.denials)} />
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

/**
 * Cómo se reparten los pedidos rechazados entre los dos motivos.
 *
 * La tarjeta muestra el total, así que la nota tiene que decir las dos mitades y no solo
 * una: con "2 se vencieron sin respuesta" arriba de un 5, los otros tres había que
 * sacarlos restando.
 */
function splitOf({ denied, expired }: Denials): string {
  if (denied === 0) return "no rechazó ninguno";
  if (expired === 0) return "todos rechazados a mano";
  if (expired === denied) return "todos vencidos sin respuesta";
  return `${denied - expired} a mano · ${expired} vencidos sin respuesta`;
}

/** "agosto 2026" no entra bajo una barra: en el eje va "ago 26". */
function shortMonth(label: string): string {
  const [name, year] = label.split(" ");
  return `${name.slice(0, 3)} ${year.slice(2)}`;
}
