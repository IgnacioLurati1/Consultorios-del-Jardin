import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaFilePdf, FaChevronDown, FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { StackedBars, ChartLegend, type Band } from "./Charts.tsx";
import { Kpi, KpiGrid, AnalyticsSection, MonthTabs } from "./Kpi.tsx";
import { ProfessionalReport } from "./ProfessionalReport.tsx";
import { AssistantUsageSection } from "./AssistantUsageSection.tsx";
import { AccessChannelsSection } from "./AccessChannelsSection.tsx";
import {
  decimal,
  findOfficeAnalytics,
  findProfessionalAnalytics,
  money,
  type OfficeAnalytics,
  type ProfessionalAnalytics,
} from "./analyticsService.ts";
import "../adminCRUDS/adminPanel.css";
import "./analytics.css";

const BILLING_BANDS: Band[] = [
  { key: "billed", label: "Cobrado (turnos asistidos)", color: "#3b7658" },
  { key: "scheduled", label: "Agendado sin cerrar", color: "#9db8ab", hatched: true },
];

const ORIGIN_BANDS: Band[] = [
  { key: "app", label: "Sacados por la app", color: "#3b7658" },
  { key: "manual", label: "Cargados por el profesional", color: "#6c788e" },
  { key: "unknown", label: "Sin dato de origen", color: "#cbd5e1" },
];

/**
 * Los números del consultorio. Cada métrica va con su promedio por profesional, que es
 * lo que deja leer cuánto mueve sumar o sacar a alguien del equipo.
 */
export function OfficeAnalyticsPage() {
  const [data, setData] = useState<OfficeAnalytics | null>(null);
  const [selected, setSelected] = useState("");
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProfessionalAnalytics | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);

  useEffect(() => {
    findOfficeAnalytics()
      .then(setData)
      .catch((err) => toast.error(`No pudimos cargar los números: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    findProfessionalAnalytics(selected)
      .then(setDetail)
      .catch((err) => {
        toast.error(`No pudimos cargar ese profesional: ${err.message}`);
        setDetail(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  const perProfessional = useMemo(() => {
    if (!data || data.headcount === 0) return null;
    return (value: number) => value / data.headcount;
  }, [data]);

  if (!data) {
    return (
      <div className="adm-page an-page">
        <AdminHeader title="Números del consultorio" subtitle="Facturación, turnos y carga del equipo" />
        <Toasts />
        <div className="adm-panel">
          <div className="prof-today-loading">
            <SkeletonLine height={20} />
            <SkeletonLine width="70%" height={20} />
            <SkeletonLine width="45%" height={20} />
          </div>
        </div>
      </div>
    );
  }

  const { recent, total, months, headcount } = data;
  const month = recent.find((item) => item.key === monthKey) ?? recent[0];

  const billingColumns = months.map((month) => ({
    label: shortMonth(month.label),
    values: [month.billed, month.scheduled],
  }));

  const originColumns = months.map((month) => ({
    label: shortMonth(month.label),
    values: [month.fromApp, month.fromProfessional, month.unknownOrigin],
  }));
  const average = (value: number) => (perProfessional ? `${money(perProfessional(value))} por profesional` : "");
  const averageCount = (value: number) =>
    perProfessional ? `${decimal(perProfessional(value))} por profesional` : "";

  return (
    <div className="adm-page an-page">
      <AdminHeader
        title="Números del consultorio"
        subtitle={
          selected
            ? "Actividad de un profesional, sin lo que factura"
            : `Facturación, turnos y carga del equipo · ${headcount} profesionales activos`
        }
        actions={
          <>
            {/* Elegir a alguien cambia toda la pantalla, así que el selector va donde
                están los controles de la pantalla y no enterrado al final de ella. */}
            <div className="an-picker">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Ver los números de un profesional"
              >
                <option value="">Todo el consultorio</option>
                {data.professionals.map((professional) => (
                  <option key={professional.email} value={professional.email}>
                    {professional.surname}, {professional.name}
                    {professional.speciality ? ` · ${professional.speciality}` : ""}
                  </option>
                ))}
              </select>
              <FaChevronDown className="an-picker-hint" aria-hidden="true" />
            </div>

            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => window.print()}>
              <FaFilePdf />
              Exportar a PDF
            </button>
          </>
        }
      />

      <Toasts />

      {/* Un profesional elegido reemplaza los números del consultorio en vez de sumarse
          abajo: son dos lecturas distintas y mezclarlas obligaba a scrollear para saber
          de quién era cada número. */}
      {selected ? (
        loadingDetail || !detail ? (
          <div className="adm-panel">
            <div className="prof-today-loading">
              <SkeletonLine height={20} />
              <SkeletonLine width="60%" height={20} />
            </div>
          </div>
        ) : (
          <div key={detail.professional.email} className="adm-enter">
            <h2 className="an-detail-title">
              {detail.professional.surname}, {detail.professional.name}
              {detail.professional.speciality ? <span className="an-muted"> · {detail.professional.speciality}</span> : null}
            </h2>
            <ProfessionalReport data={detail} />
          </div>
        )
      ) : (
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
                average(month.billed)
              )
            }
          />
          <Kpi label="Asistencias" value={month.assisted} note={averageCount(month.assisted)} />
          <Kpi label="Cancelados" value={month.cancelled} note={averageCount(month.cancelled)} />
          <Kpi
            label="Sobreturnos"
            value={month.overbooked}
            note={month.topOverbooker ? `más: ${month.topOverbooker.name} (${month.topOverbooker.count})` : "ninguno"}
          />
        </KpiGrid>
      </AnalyticsSection>

      <AnalyticsSection title="Facturación" scope={`Últimos ${total.months} meses cerrados`}>
        <p className="an-note">
          El mes en curso no entra en los gráficos hasta que termine. La línea punteada es el promedio mensual del consultorio:
          sirve para ver de un vistazo qué meses quedaron arriba y cuáles abajo.
        </p>
        <StackedBars
          bands={BILLING_BANDS}
          columns={billingColumns}
          format={(value) => money(value)}
          reference={
            total.months > 0 && total.billed > 0
              ? { value: total.billed / total.months, label: `promedio mensual · ${money(total.billed / total.months)}` }
              : undefined
          }
          empty="Todavía no hay meses cerrados con turnos cobrados."
        />
        <ChartLegend bands={BILLING_BANDS} columns={billingColumns} />
      </AnalyticsSection>

      <AnalyticsSection title="De dónde salen los turnos" scope={`Últimos ${total.months} meses cerrados`}>
        <StackedBars
          bands={ORIGIN_BANDS}
          columns={originColumns}
          format={(value) => String(Math.round(value))}
          empty="Todavía no hay meses cerrados con turnos."
        />
        <ChartLegend bands={ORIGIN_BANDS} columns={originColumns} />
      </AnalyticsSection>

      <AnalyticsSection title="Acumulado" scope={`Últimos ${total.months} meses cerrados`}>
        <KpiGrid>
          <Kpi lead label="Cobrado" value={money(total.billed)} note={average(total.billed)} />
          <Kpi label="Asistencias" value={total.assisted} note={averageCount(total.assisted)} />
          <Kpi label="Turnos cancelados" value={total.cancelled} note={averageCount(total.cancelled)} />
          <Kpi
            label="Sobreturnos"
            value={total.overbooked}
            note={total.topOverbooker ? `más: ${total.topOverbooker.name} (${total.topOverbooker.count})` : "ninguno"}
          />
          <Kpi
            label="Cargados a mano"
            value={total.fromProfessional}
            note={total.unknownOrigin > 0 ? `${total.unknownOrigin} sin dato de origen` : averageCount(total.fromProfessional)}
          />
          <Kpi label="Sacados por la app" value={total.fromApp} note={averageCount(total.fromApp)} />
          <Kpi
            label="Pacientes con más de un profesional"
            value={total.sharedPatients}
            note={`sobre ${total.patients} pacientes distintos`}
          />
          <Kpi
            label="Turnos por día"
            value={decimal(total.averagePerDay)}
            note={
              total.busiestDay
                ? `el ${total.busiestDay} es el más cargado, con ${decimal(total.busiestDayAverage)}`
                : "sobre los días que se atendió"
            }
          />
        </KpiGrid>
      </AnalyticsSection>

      {/* Por dónde entra la gente y lo que gasta el asistente son números del sistema,
          no del consultorio: le sirven a quien lo mantiene y le estorban a quien vino a
          ver cómo viene el mes. */}
      <button
        type="button"
        className={`adm-section-toggle ${systemOpen ? "open" : ""}`}
        onClick={() => setSystemOpen((open) => !open)}
        aria-expanded={systemOpen}
        aria-controls="an-system"
      >
        <span className="adm-plus">
          <FaPlus />
        </span>
        {systemOpen ? "Ocultar números del sistema" : "Números del sistema"}
      </button>

      <div id="an-system" className={`adm-collapsible ${systemOpen ? "open" : ""}`}>
        <div>
          <div className="adm-collapsible-inner">
            <AccessChannelsSection channels={data.channels} />
            <AssistantUsageSection />
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function shortMonth(label: string): string {
  const [name, year] = label.split(" ");
  return `${name.slice(0, 3)} ${year.slice(2)}`;
}
