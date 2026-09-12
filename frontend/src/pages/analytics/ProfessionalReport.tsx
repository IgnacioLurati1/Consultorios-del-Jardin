import { useState } from "react";
import { StackedBars, ChartLegend, type Band } from "./Charts.tsx";
import { Kpi, KpiGrid, AnalyticsSection, MonthTabs } from "./Kpi.tsx";
import { decimal, money, type Denials, type ProfessionalAnalytics, type ProfessionalRecentMonth } from "./analyticsService.ts";
import { WaitlistPeopleModal } from "../appointments/waitlist/WaitlistPeopleModal.tsx";

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

  // La lista de espera se abre solo desde los números propios. El admin ve cuánta gente
  // espera, que es un dato de la carga del equipo, pero no quiénes son.
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  /** Cuántos quedaron después de sacar a alguien desde la ventana, sin volver a pedir todo. */
  const [waitingNow, setWaitingNow] = useState<number | null>(null);

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
                  "de los turnos ya cobrados"
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
              label="Adeudado"
              value={money(month.debt.amount)}
              tone={month.debt.amount > 0 ? "danger" : undefined}
              /* El número dice cuánto; la pregunta que sigue siempre es quién. Lleva a la
                 lista con el filtro puesto, que es la pantalla desde la que se hace algo
                 al respecto. Sin nadie debiendo no lleva a ninguna parte: sería mandar a
                 alguien a una lista vacía. */
              to={month.debt.amount > 0 ? "/Patients?adeudan=1" : undefined}
              toHint="Ver pacientes con deuda"
              note={
                month.debt.appointments === 0
                  ? "todo lo atendido está cobrado"
                  : `${month.debt.appointments} ${month.debt.appointments === 1 ? "turno" : "turnos"} · ${
                      month.debt.people
                    } ${month.debt.people === 1 ? "persona" : "personas"}`
              }
            />
          )}
          <Kpi label="Turnos especiales" value={month.overbooked} note="fuera de los módulos de atención" />
          <Kpi label="Pedidos rechazados" value={month.denials.denied} note={splitOf(month.denials)} />
          {month.waitlist && (
            <Kpi
              label="Lista de espera"
              value={month.waitlist.enabled ? (waitingNow ?? month.waitlist.current) : "—"}
              note={waitlistNote(month.waitlist, month.inProgress)}
              onClick={showsBilling && month.waitlist.enabled ? () => setWaitlistOpen(true) : undefined}
              toHint="Ver la lista de espera"
            />
          )}
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
              label="Adeudado"
              value={data.debt.people}
              to={data.debt.people > 0 ? "/Patients?adeudan=1" : undefined}
              toHint="Ver pacientes con deuda"
              note={
                data.debt.people === 0
                  ? "sin turnos adeudados"
                  : `${data.debt.people === 1 ? "persona" : "personas"} · ${data.debt.appointments} ${
                      data.debt.appointments === 1 ? "turno" : "turnos"
                    } por ${money(data.debt.amount)}`
              }
            />
          )}
          <Kpi label="Cancelados o ausentes" value={lost} note={`${lostRate}% de los ${given} turnos dados`} />
          <Kpi label="Turnos especiales" value={total.overbooked} />
          <Kpi label="Pedidos rechazados" value={total.denials.denied} note={splitOf(total.denials)} />
          <Kpi
            label="Turnos sacados por la app"
            value={total.fromApp}
            note={
              total.imported > 0
                ? `${total.fromProfessional} cargados a mano y ${total.imported} importados`
                : total.unknownOrigin > 0
                  ? `${total.unknownOrigin} turnos sin dato de origen`
                  : `${total.fromProfessional} cargados a mano`
            }
          />
          <Kpi
            label="Turnos por día"
            value={decimal(total.averagePerDay)}
            note={
              total.busiestDay
                ? `el ${total.busiestDay} es el más cargado, con ${decimal(total.busiestDayAverage)}`
                : "sobre los días con atención"
            }
          />
        </KpiGrid>
      </AnalyticsSection>

      {showsBilling && (
        <WaitlistPeopleModal
          open={waitlistOpen}
          onClose={() => setWaitlistOpen(false)}
          onChanged={(list) => setWaitingNow(list.length)}
        />
      )}
    </>
  );
}

/**
 * La aclaración de la tarjeta de la lista de espera.
 *
 * El número grande es cuántos esperan hoy, sea el mes que sea: es lo único que la lista
 * sabe de sí misma. El promedio sí es del mes elegido, y sale de la foto de cada noche,
 * así que el primer día que se mide todavía no hay.
 */
function waitlistNote(waitlist: NonNullable<ProfessionalRecentMonth["waitlist"]>, inProgress: boolean): string {
  if (!waitlist.enabled) return "no trabaja con lista de espera";
  if (waitlist.average === null)
    return inProgress ? "esperando hoy · el promedio se calcula cada noche" : "esperando hoy · de ese mes no hay datos";
  return `esperando hoy · ${decimal(waitlist.average)} por día en promedio`;
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
