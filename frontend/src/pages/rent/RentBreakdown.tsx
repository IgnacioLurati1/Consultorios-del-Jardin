import { money } from "../analytics/analyticsService.ts";
import { BLOCK_LABEL, DAY_LABEL, formatAdjust, type Breakdown } from "./rentService.ts";

/**
 * Los precios son por mes y cada línea se cobra una vez. Las cuotas guardadas antes de ese
 * cambio multiplicaban por las semanas del mes, y esas siguen mostrando la cuenta.
 */
function calc(times: number, price: number) {
  return times === 1 ? "por mes" : `${times} × ${money(price)}`;
}

/**
 * El horario real del módulo. Es lo que deja ver que un módulo de la mañana cayó a la
 * tarde. Las cuotas guardadas antes de los módulos no lo tienen y muestran solo el nombre.
 */
function span(line: { from?: string; to?: string }): string {
  return line.from && line.to ? ` de ${line.from} a ${line.to}` : "";
}

/**
 * De qué sale una cuota calculada con los módulos: cada tramo, con qué precio se cobra y
 * en qué horario cayó. Es lo que se mira cuando un número no cierra.
 */
export function RentBreakdown({ breakdown }: { breakdown: Breakdown }) {
  return (
    <div className="rent-breakdown">
      {breakdown.blocks.length > 0 && (
        <ul className="rent-lines">
          {breakdown.blocks.map((line) => (
            <li key={`${line.roomId}-${line.day}-${line.block}-${line.from ?? ""}`}>
              <span>
                {line.room} · {DAY_LABEL[line.day] ?? line.day} · módulo {BLOCK_LABEL[line.block].toLowerCase()}
                {span(line)}
              </span>
              <span className="rent-line-calc">
                {line.price === null ? "sin precio" : calc(line.times, line.price)}
              </span>
              <strong>{money(line.subtotal)}</strong>
            </li>
          ))}
        </ul>
      )}

      {(breakdown.days?.length ?? 0) > 0 && (
        <ul className="rent-lines">
          {breakdown.days!.map((line) => (
            <li key={`${line.roomId}-${line.day}-day-${line.from ?? ""}`}>
              <span>
                {line.room} · {DAY_LABEL[line.day] ?? line.day} · día entero
                {span(line)}
              </span>
              <span className="rent-line-calc">
                {line.price === null ? "sin precio" : calc(line.times, line.price)}
              </span>
              <strong>{money(line.subtotal)}</strong>
            </li>
          ))}
        </ul>
      )}

      {breakdown.outside.length > 0 && (
        <ul className="rent-lines">
          {breakdown.outside.map((line) => (
            <li key={`${line.day}-${line.initialHour}`}>
              <span>
                {line.room} · {DAY_LABEL[line.day] ?? line.day}{" "}
                {line.parts.map((part) => `de ${part.from} a ${part.to}`).join(" y ")}
              </span>
              <span className="rent-line-calc">
                {line.price === null ? "sin valor" : calc(line.times, line.price)}
              </span>
              <strong>{money(line.subtotal)}</strong>
            </li>
          ))}
        </ul>
      )}

      {breakdown.adjust !== 0 && (
        <p className="rent-sub">
          Aumento propio de {formatAdjust(breakdown.adjust)} sobre {money(breakdown.base)}
        </p>
      )}

      {breakdown.missing.map((message) => (
        <p key={message} className="rent-warn">
          {message}
        </p>
      ))}
    </div>
  );
}
