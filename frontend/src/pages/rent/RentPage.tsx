import { Fragment, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaArrowTrendUp,
  FaCalculator,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaFileExcel,
  FaPen,
  FaTags,
} from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { Kpi, KpiGrid } from "../analytics/Kpi.tsx";
import { money } from "../analytics/analyticsService.ts";
import { RentBreakdown } from "./RentBreakdown.tsx";
import { AmountModal, DueDayModal, PaymentModal } from "./RentModals.tsx";
import { RoomPricesModal } from "./RoomPricesModal.tsx";
import { CalculateModal } from "./CalculateModal.tsx";
import { IncreaseModal } from "./IncreaseModal.tsx";
import {
  STATUS_LABEL,
  capitalize,
  downloadRentExcel,
  errorText,
  findRentMonth,
  formatAdjust,
  isMonthKey,
  monthKeyOf,
  monthName,
  setRentPayment,
  shiftMonth,
  toLocalDate,
  todayISO,
  type RentMonth,
  type RentRow,
} from "./rentService.ts";
import "../../components/modal/modal.css";
import "../adminCRUDS/adminPanel.css";
import "../analytics/analytics.css";
import "./rent.css";

type Filter = "all" | "pending" | "paid" | "late";
type Dialog = "prices" | "calculate" | "increase" | "dueDay" | null;

const FILTERS: { key: Filter; label: string; test: (row: RentRow) => boolean }[] = [
  { key: "all", label: "Todos", test: () => true },
  { key: "pending", label: "Con saldo", test: (row) => row.pending > 0 },
  { key: "paid", label: "Pagaron", test: (row) => row.status === "paid" },
  { key: "late", label: "Fuera de término", test: (row) => row.late },
];

/** Hasta cuántos meses para atrás se puede ir aunque no haya cuotas, para cargar historia vieja. */
const MONTHS_BACK = 36;

const BADGE: Record<RentRow["status"], string> = {
  paid: "adm-badge-green",
  partial: "adm-badge-amber",
  unpaid: "adm-badge-grey",
  none: "adm-badge-grey",
};

/**
 * Los alquileres: cuánto paga cada profesional por mes, si pagó y cuándo.
 *
 * La pantalla es la lista del mes. Arriba van los totales, que es lo que se mira primero,
 * y en cada fila lo que se hace más seguido, que es marcar que alguien pagó hoy. Lo demás
 * (otra fecha, un pago parcial, cambiar la cuota) está un toque más adentro, en ventanas.
 *
 * Los botones del encabezado cambian reglas de todos: calcular con los bloques, aplicar
 * un aumento y los precios de los consultorios. Rigen desde este mes o el que viene, sin
 * importar qué mes se esté mirando.
 */
export function RentPage() {
  const [params, setParams] = useSearchParams();
  const thisMonth = monthKeyOf();

  // Desde los números se llega con ?mes=2026-09&estado=pendientes.
  const asked = params.get("mes");
  const [month, setMonth] = useState(isMonthKey(asked) && asked <= shiftMonth(thisMonth, 1) ? asked : thisMonth);
  const [filter, setFilter] = useState<Filter>(params.get("estado") === "pendientes" ? "pending" : "all");

  const [data, setData] = useState<RentMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paying, setPaying] = useState<RentRow | null>(null);
  const [editing, setEditing] = useState<RentRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // El mes que se está mirando ahora. Una respuesta que vuelve después de cambiar de mes
  // no puede pisar la pantalla con los números del mes anterior.
  const shown = useRef(month);
  shown.current = month;

  const reload = () => setReloadKey((key) => key + 1);

  function accept(result: RentMonth) {
    if (result.month === shown.current) setData(result);
  }

  // La dirección acompaña al mes y al filtro, así un recargo o un link compartido abren lo mismo.
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("mes", month);
    if (filter === "pending") next.set("estado", "pendientes");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [month, filter, params, setParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    findRentMonth(month)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((problem) => {
        if (!cancelled) toast.error(problem.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, reloadKey]);

  async function markPaidToday(row: RentRow) {
    setBusyRow(row.email);
    try {
      accept(await setRentPayment(month, row.email, { status: "paid", paidOn: todayISO() }));
      toast.success(`Pago de ${row.name} ${row.surname} registrado`);
    } catch (problem) {
      toast.error(errorText(problem));
    } finally {
      setBusyRow(null);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadRentExcel(month);
    } catch (problem) {
      toast.error(errorText(problem));
    } finally {
      setDownloading(false);
    }
  }

  const current = data?.current ?? thisMonth;
  const oldest = shiftMonth(current, -MONTHS_BACK);
  const minMonth = data && data.firstMonth < oldest ? data.firstMonth : oldest;
  const maxMonth = data?.next ?? shiftMonth(thisMonth, 1);
  const upcoming = month > current;

  const rows = data?.rows ?? [];
  const activeFilter = FILTERS.find((item) => item.key === filter)!;
  const visible = rows.filter(activeFilter.test);
  const withoutAmount = rows.filter((row) => row.active && row.amount === null).length;
  const withWarnings = rows.filter((row) => row.warnings.length > 0).length;

  return (
    <div className="adm-page rent-page">
      <AdminHeader
        title="Alquileres"
        subtitleIsData
        subtitle={data ? `${capitalize(data.label)} · vencimiento el día ${data.dueDay}` : "Cuotas de los profesionales"}
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDialog("prices")}>
              <FaTags />
              Precios
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDialog("increase")}>
              <FaArrowTrendUp />
              Aumento
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => setDialog("calculate")}>
              <FaCalculator />
              Calcular
            </button>
          </>
        }
      />

      <Toasts />

      <div className="rent-bar">
        <div className="rent-month" role="group" aria-label="Mes">
          <button
            type="button"
            className="rent-month-step"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={month <= minMonth}
            aria-label="Mes anterior"
          >
            <FaChevronLeft />
          </button>
          <span className="rent-month-name">{monthName(month)}</span>
          <button
            type="button"
            className="rent-month-step"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= maxMonth}
            aria-label="Mes siguiente"
          >
            <FaChevronRight />
          </button>
        </div>

        {month === current ? (
          <span className="rent-month-tag">En curso</span>
        ) : upcoming ? (
          <span className="rent-month-tag">Estimado con las reglas de hoy</span>
        ) : null}

        {month !== current && (
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setMonth(current)}>
            Ir al mes en curso
          </button>
        )}

        <button type="button" className="adm-btn adm-btn-accent rent-excel" onClick={download} disabled={downloading || !data}>
          <FaFileExcel />
          {downloading ? "Preparando…" : "Exportar a Excel"}
        </button>
      </div>

      {data && (
        <div className={loading ? "adm-swapping" : ""}>
          <KpiGrid>
            <Kpi
              lead
              label="Cuotas del mes"
              value={money(data.totals.due)}
              note={`${rows.filter((row) => row.amount !== null).length} profesionales${upcoming ? " · estimado" : ""}`}
            />
            <Kpi
              label="Cobrado"
              value={money(data.totals.collected)}
              note={data.totals.paid === 1 ? "1 cuota paga" : `${data.totals.paid} cuotas pagas`}
            />
            <Kpi
              label="Pendiente"
              value={money(data.totals.pending)}
              tone={data.totals.late > 0 ? "danger" : undefined}
              note={`${data.totals.partial + data.totals.unpaid} con saldo`}
              onClick={() => setFilter("pending")}
              toHint="Ver las cuotas con saldo"
            />
            <Kpi
              label="Fuera de término"
              value={data.totals.late}
              note={`vencimiento el día ${data.dueDay}`}
              onClick={() => setDialog("dueDay")}
              toHint="Cambiar el día de vencimiento"
            />
          </KpiGrid>
        </div>
      )}

      {data && month >= current && withoutAmount > 0 && (
        <p className="ui-alert ui-alert-warn rent-alert">
          {withoutAmount === 1 ? "Un profesional sin cuota." : `${withoutAmount} profesionales sin cuota.`} «Calcular» la arma con
          los bloques de su agenda, y el lápiz de cada fila la deja fija.
        </p>
      )}

      {data && withWarnings > 0 && (
        <p className="ui-alert ui-alert-warn rent-alert">
          {withWarnings === 1 ? "Una cuota tiene" : `${withWarnings} cuotas tienen`} bloques o franjas sin precio, que no suman. El
          detalle de cada fila dice cuáles.
        </p>
      )}

      <div className="adm-chips rent-filters" role="group" aria-label="Filtrar">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? "active" : ""}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            <span className="adm-chip-count">{rows.filter(item.test).length}</span>
          </button>
        ))}
      </div>

      <div className={`adm-panel ${loading && data ? "adm-swapping" : ""}`}>
        {!data ? (
          <div className="rent-loading rent-loading-panel">
            <SkeletonLine height={20} />
            <SkeletonLine width="80%" height={20} />
            <SkeletonLine width="60%" height={20} />
          </div>
        ) : visible.length === 0 ? (
          <div className="adm-empty">
            {rows.length === 0
              ? month < current
                ? `Sin cuotas registradas en ${data.label}.`
                : "Sin profesionales habilitados."
              : "Ninguna cuota en este filtro."}
          </div>
        ) : (
          <div className="rent-scroll">
            <table className="rent-table">
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Cuota</th>
                  <th>Estado</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>
                    <span className="rent-sr">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const open = expanded === row.email;
                  const payable = row.amount !== null && row.amount > 0;

                  return (
                    <Fragment key={row.email}>
                      <tr className={row.active ? "" : "rent-row-off"}>
                        <td>
                          <div className="rent-who">
                            <strong>
                              {row.surname}, {row.name}
                            </strong>
                            <span className="rent-sub">
                              {[row.speciality, row.active ? null : "deshabilitado"].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="rent-amount">
                            {row.amount === null ? <span className="rent-muted">Sin cuota</span> : <span className="rent-money">{money(row.amount)}</span>}
                            <button
                              type="button"
                              className="rent-icon-btn"
                              title="Cambiar la cuota"
                              aria-label={`Cambiar la cuota de ${row.name} ${row.surname}`}
                              onClick={() => setEditing(row)}
                            >
                              <FaPen />
                            </button>
                          </div>
                          <span className="rent-sub">{kindText(row)}</span>
                          {row.warnings.length > 0 && <span className="rent-warn">Falta un precio</span>}
                        </td>

                        <td>
                          <div className="rent-badges">
                            <span className={`adm-badge ${BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                            {row.late && <span className="adm-badge adm-badge-red">Fuera de término</span>}
                          </div>
                        </td>

                        <td>
                          {row.paidAmount > 0 ? (
                            <>
                              <span className="rent-money">{money(row.paidAmount)}</span>
                              {row.paidOn && <span className="rent-sub">el {toLocalDate(row.paidOn)}</span>}
                            </>
                          ) : (
                            <span className="rent-muted">—</span>
                          )}
                        </td>

                        <td>
                          {row.amount === null ? (
                            <span className="rent-muted">—</span>
                          ) : (
                            <span className={`rent-money ${row.pending > 0 && row.late ? "rent-owed" : ""}`}>{money(row.pending)}</span>
                          )}
                        </td>

                        <td>
                          <div className="rent-actions">
                            {payable && row.status !== "paid" && (
                              <button
                                type="button"
                                className="adm-btn adm-btn-primary adm-btn-sm"
                                disabled={busyRow === row.email}
                                onClick={() => markPaidToday(row)}
                              >
                                {busyRow === row.email ? "Guardando…" : "Pagó hoy"}
                              </button>
                            )}
                            {payable && (
                              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setPaying(row)}>
                                {row.status === "unpaid" ? "Otro pago" : "Editar pago"}
                              </button>
                            )}
                            {row.breakdown && (
                              <button
                                type="button"
                                className="rent-icon-btn"
                                title={open ? "Ocultar el detalle" : "Ver el detalle"}
                                aria-label={open ? "Ocultar el detalle" : "Ver el detalle"}
                                aria-expanded={open}
                                onClick={() => setExpanded(open ? null : row.email)}
                              >
                                <FaChevronDown className={open ? "rent-chevron open" : "rent-chevron"} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {open && row.breakdown && (
                        <tr className="rent-detail-row">
                          <td colSpan={6}>
                            <RentBreakdown breakdown={row.breakdown} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && (
        <>
          <PaymentModal row={paying} data={data} onClose={() => setPaying(null)} onSaved={accept} />
          <AmountModal row={editing} data={data} onClose={() => setEditing(null)} onSaved={accept} />
          <DueDayModal open={dialog === "dueDay"} dueDay={data.dueDay} onClose={() => setDialog(null)} onSaved={reload} />
        </>
      )}

      <RoomPricesModal open={dialog === "prices"} onClose={() => setDialog(null)} onSaved={reload} />
      <CalculateModal
        open={dialog === "calculate"}
        onClose={() => setDialog(null)}
        onApplied={reload}
        onOpenPrices={() => setDialog("prices")}
      />
      <IncreaseModal open={dialog === "increase"} onClose={() => setDialog(null)} onApplied={reload} />
    </div>
  );
}

/** De dónde sale la cuota, en la línea chica de abajo del monto. */
function kindText(row: RentRow): string {
  if (row.kind === "blocks") {
    const blocks = row.blocks === 1 ? "1 bloque en el mes" : `${row.blocks ?? 0} bloques en el mes`;
    const adjust = row.breakdown?.adjust ? ` · ${formatAdjust(row.breakdown.adjust)}` : "";
    return `${blocks}${adjust}`;
  }
  if (row.kind === "fixed") return "Cuota fija";
  if (row.hasSchedule === false) return "Sin horarios";
  return "";
}
