import { useState } from "react";
import { AnalyticsSection } from "./Kpi.tsx";
import { money } from "./analyticsService.ts";
import {
  BLOCK_LABEL,
  findFreeBlocks,
  monthKeyOf,
  monthName,
  shiftMonth,
  simulateIncrease,
  type FreeBlocksReport,
  type IncreaseSimulation,
} from "../rent/rentService.ts";

const SHORT_DAY: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
};

/**
 * Cuánto más podría dejar el alquiler. Dos cuentas, cada una con su botón:
 *
 * - Los bloques libres de cada consultorio, a su precio.
 * - Un aumento, en porcentaje sobre las cuotas o en pesos por cada bloque alquilado.
 *
 * Nada de esto corre al abrir la pantalla. Las dos recorren la agenda de todos los
 * consultorios, y los números se abren muchas veces para mirar otra cosa: se calcula
 * cuando alguien lo pide.
 */
export function RentPotentialSection() {
  const current = monthKeyOf();
  const months = [current, shiftMonth(current, 1)];

  const [month, setMonth] = useState(current);

  const [free, setFree] = useState<FreeBlocksReport | null>(null);
  const [freeBusy, setFreeBusy] = useState(false);
  const [freeError, setFreeError] = useState("");

  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [sim, setSim] = useState<IncreaseSimulation | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState("");

  function searchFree() {
    setFreeBusy(true);
    setFreeError("");
    findFreeBlocks(month)
      .then(setFree)
      .catch((problem) => setFreeError(problem.message))
      .finally(() => setFreeBusy(false));
  }

  function simulate() {
    const number = Number(value.replace(",", "."));
    if (!Number.isFinite(number) || number <= 0)
      return setSimError(mode === "percent" ? "Falta el porcentaje del aumento" : "Falta el aumento por bloque");

    setSimBusy(true);
    setSimError("");
    simulateIncrease(month, mode, number)
      .then(setSim)
      .catch((problem) => setSimError(problem.message))
      .finally(() => setSimBusy(false));
  }

  return (
    <AnalyticsSection
      title="Potencial de alquiler"
      scope="se calcula a pedido"
      actions={
        <div className="adm-chips an-months" role="group" aria-label="Mes">
          {months.map((key) => (
            <button
              key={key}
              type="button"
              className={month === key ? "active" : ""}
              aria-pressed={month === key}
              onClick={() => setMonth(key)}
            >
              {monthName(key)}
            </button>
          ))}
        </div>
      }
    >
      <div className="an-potential-grid">
        <div className="adm-panel an-potential">
          <div className="adm-panel-head">Bloques libres</div>
          <div className="an-potential-body">
            <p className="an-potential-text">
              Los bloques de cada consultorio que nadie usa, de lunes a viernes, y lo que dejarían por mes alquilados a su
              precio.
            </p>
            <button type="button" className="adm-btn adm-btn-primary" onClick={searchFree} disabled={freeBusy}>
              {freeBusy ? "Buscando…" : "Buscar bloques libres"}
            </button>
            {freeError && <p className="ui-alert ui-alert-error">{freeError}</p>}
            {free && <FreeBlocks report={free} />}
          </div>
        </div>

        <div className="adm-panel an-potential">
          <div className="adm-panel-head">Si sube el alquiler</div>
          <div className="an-potential-body">
            <p className="an-potential-text">Cuánto más entraría por mes con un aumento sobre lo que se cobra hoy.</p>

            <div className="adm-chips" role="group" aria-label="Tipo de aumento">
              {(
                [
                  ["percent", "En porcentaje"],
                  ["amount", "En pesos por bloque"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={mode === key ? "active" : ""}
                  aria-pressed={mode === key}
                  onClick={() => {
                    setMode(key);
                    setSim(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="an-potential-form">
              <label className="ui-field">
                <span>{mode === "percent" ? "Aumento en %" : "Aumento por bloque en pesos"}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={mode === "percent" ? 0.5 : 100}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") simulate();
                  }}
                />
              </label>
              <button type="button" className="adm-btn adm-btn-primary" onClick={simulate} disabled={simBusy}>
                {simBusy ? "Calculando…" : "Calcular"}
              </button>
            </div>

            {simError && <p className="ui-alert ui-alert-error">{simError}</p>}
            {sim && <Simulation sim={sim} />}
          </div>
        </div>
      </div>
    </AnalyticsSection>
  );
}

function FreeBlocks({ report }: { report: FreeBlocksReport }) {
  const { totals } = report;

  return (
    <div className="an-potential-result">
      <p className="an-potential-lead">
        {totals.free === 0 ? (
          <>Todos los bloques de {report.label} están alquilados.</>
        ) : (
          <>
            <strong>{money(totals.potential)}</strong> más por mes en {report.label}, con los {totals.free} bloques libres de
            cada semana alquilados
          </>
        )}
      </p>

      {totals.unpriced > 0 && (
        <p className="an-potential-warn">
          {totals.unpriced === 1 ? "Un bloque libre no tiene precio" : `${totals.unpriced} bloques libres no tienen precio`} y
          no suma. Los precios se cargan en Alquileres.
        </p>
      )}

      <ul className="an-free-list">
        {report.rooms.map((room) => (
          <li key={room.roomId}>
            <div className="an-free-head">
              <span>
                <strong>{room.room}</strong> <span className="an-muted">· {room.office}</span>
              </span>
              <span className="an-free-amount">{room.free.length === 0 ? "Completo" : money(room.potential)}</span>
            </div>
            {room.free.length > 0 && (
              <div className="an-free-chips">
                {room.free.map((block) => (
                  <span
                    key={`${block.day}-${block.block}`}
                    className={`an-free-chip ${block.price === null ? "unpriced" : ""}`}
                    title={block.price === null ? "Sin precio" : `${money(block.price)} por mes`}
                  >
                    {SHORT_DAY[block.day] ?? block.day} {BLOCK_LABEL[block.block].toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Simulation({ sim }: { sim: IncreaseSimulation }) {
  return (
    <div className="an-potential-result">
      <dl className="an-sim">
        <div>
          <dt>Cuotas de {sim.label}</dt>
          <dd>{money(sim.monthly)}</dd>
        </div>
        <div>
          <dt>Con el aumento</dt>
          <dd>
            {money(sim.projected)} <span className="an-sim-up">+{money(sim.added)} por mes</span>
          </dd>
        </div>
        <div>
          <dt>En un año</dt>
          <dd>
            <span className="an-sim-up">+{money(sim.yearly)}</span>
          </dd>
        </div>
        <div>
          <dt>Con los bloques libres alquilados</dt>
          <dd>
            {money(sim.free.potential)} → {money(sim.free.after)}
          </dd>
        </div>
      </dl>
      <p className="an-potential-text">
        {sim.mode === "percent"
          ? `Sobre todas las cuotas del mes, fijas o por bloques.`
          : `${sim.times} bloques alquilados en el mes, cada uno ${money(sim.value)} más.`}
      </p>
    </div>
  );
}
