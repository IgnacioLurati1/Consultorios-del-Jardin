import type { ReactNode } from "react";

/**
 * Gráficos del panel. Son SVG a mano y no una librería: son dos formas, tienen que
 * imprimirse bien en el PDF y una dependencia más para esto no se paga.
 */

export interface Band {
  key: string;
  label: string;
  color: string;
  /** Rayado en diagonal, para lo que todavía no está cerrado. */
  hatched?: boolean;
}

export interface Column {
  label: string;
  /** Un valor por banda, en el mismo orden. */
  values: number[];
}

interface StackedBarsProps {
  bands: Band[];
  columns: Column[];
  /** Cómo se escribe un total en el eje y en el tooltip. */
  format: (value: number) => string;
  /** Línea de referencia horizontal, por ejemplo un promedio. */
  reference?: { value: number; label: string };
  empty?: ReactNode;
}

const WIDTH = 900;
const HEIGHT = 300;
const PAD = { top: 18, right: 16, bottom: 46 };

/**
 * Cuánto lugar dejarle al eje. Se mide contra la etiqueta más larga: con 64px fijos,
 * un consultorio que factura millones se quedaba sin el "$" adelante.
 */
function axisWidth(labels: string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.min(140, Math.max(46, longest * 7.6 + 14));
}

/** Escala "linda": el eje termina en un número redondo y no en el máximo crudo. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  return magnitude * (steps.find((step) => value <= magnitude * step) ?? 10);
}

export function StackedBars({ bands, columns, format, reference, empty }: StackedBarsProps) {
  const totals = columns.map((column) => column.values.reduce((sum, value) => sum + value, 0));
  const max = niceMax(Math.max(...totals, reference?.value ?? 0));

  if (totals.every((total) => total === 0)) {
    return <div className="an-chart-empty">{empty ?? "Todavía no hay datos en estos meses."}</div>;
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  const left = axisWidth(ticks.map(format));

  const plotWidth = WIDTH - left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / columns.length;
  const barWidth = Math.min(46, slot * 0.62);

  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="an-chart-wrap">
      <svg className="an-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" preserveAspectRatio="xMidYMid meet">
      <defs>
        {bands
          .filter((band) => band.hatched)
          .map((band) => (
            <pattern key={band.key} id={`hatch-${band.key}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill={band.color} opacity="0.35" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={band.color} strokeWidth="3" />
            </pattern>
          ))}
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="an-grid" />
          <text x={left - 10} y={y(tick) + 4} className="an-axis" textAnchor="end">
            {format(tick)}
          </text>
        </g>
      ))}

      {columns.map((column, index) => {
        const x = left + slot * index + (slot - barWidth) / 2;
        let cursor = 0;

        return (
          <g key={column.label}>
            <title>{`${column.label}: ${format(totals[index])}`}</title>

            {column.values.map((value, bandIndex) => {
              if (value <= 0) return null;
              const band = bands[bandIndex];
              const top = y(cursor + value);
              const height = y(cursor) - top;
              cursor += value;

              return (
                <rect
                  key={band.key}
                  x={x}
                  y={top}
                  width={barWidth}
                  height={Math.max(height, 1)}
                  fill={band.hatched ? `url(#hatch-${band.key})` : band.color}
                  rx="3"
                />
              );
            })}

            <text x={x + barWidth / 2} y={HEIGHT - PAD.bottom + 20} className="an-axis" textAnchor="middle">
              {column.label}
            </text>
          </g>
        );
      })}

        {/* La referencia va arriba de las barras: si no, las tapa justo donde hay que leerla. */}
        {reference && reference.value > 0 && (
          <g>
            <line
              x1={left}
              x2={WIDTH - PAD.right}
              y1={y(reference.value)}
              y2={y(reference.value)}
              className="an-reference"
            />
            <text x={left + 6} y={y(reference.value) - 8} className="an-reference-label">
              {reference.label}
            </text>
          </g>
        )}

        <line x1={left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="an-baseline" />
      </svg>
    </div>
  );
}

/**
 * Referencias del gráfico. Van fuera del SVG para que respeten el tamaño de fuente de la
 * página. Si se le pasan las columnas, esconde las bandas que están en cero en todos los
 * meses: una referencia que no se corresponde con nada dibujado solo confunde.
 */
export function ChartLegend({ bands, columns }: { bands: Band[]; columns?: Column[] }) {
  const used = columns
    ? bands.filter((_, index) => columns.some((column) => (column.values[index] ?? 0) > 0))
    : bands;

  if (used.length === 0) return null;

  return (
    <ul className="an-legend">
      {used.map((band) => (
        <li key={band.key}>
          <span
            className="an-legend-swatch"
            style={
              band.hatched
                ? { backgroundImage: `repeating-linear-gradient(45deg, ${band.color} 0 3px, transparent 3px 6px)` }
                : { background: band.color }
            }
          />
          {band.label}
        </li>
      ))}
    </ul>
  );
}
