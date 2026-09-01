import "../../pages/adminCRUDS/adminPanel.css";

/**
 * Placeholders de carga. Se usan mientras se piden los datos, para que la
 * pantalla no quede en blanco y no salte de altura cuando llegan.
 */

export function SkeletonLine({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return <div className="adm-skeleton" style={{ width, height }} aria-hidden="true" />;
}

/** Filas de una lista: un bloque grande y dos líneas de texto. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="adm-skeleton-row" key={i}>
          <div className="adm-skeleton" style={{ width: 38, height: 38, borderRadius: 10 }} aria-hidden="true" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonLine width={`${45 + ((i * 13) % 30)}%`} />
            <SkeletonLine width={`${25 + ((i * 17) % 25)}%`} height={11} />
          </div>
          <div className="adm-skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

/** Grilla semanal de horarios: seis columnas con bloques de distinta altura. */
export function SkeletonGrid({ columns = 6 }: { columns?: number }) {
  const heights = [90, 140, 70, 110, 60, 130];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando horarios"
      style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12, width: "100%" }}
    >
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="adm-skeleton" style={{ height: 34, borderRadius: 8 }} aria-hidden="true" />
          <div className="adm-skeleton" style={{ height: heights[col % heights.length], borderRadius: 8 }} aria-hidden="true" />
          <div className="adm-skeleton" style={{ height: heights[(col + 3) % heights.length], borderRadius: 8 }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
