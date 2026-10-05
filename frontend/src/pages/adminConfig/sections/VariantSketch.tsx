import type { CSSProperties, ReactNode } from "react";

/**
 * Un dibujo chico de cada diseño de sección, para elegir sin tener que probarlos uno por
 * uno. No es la portada: es su esqueleto, con las proporciones de cada diseño. La portada
 * de verdad está abajo, en la vista previa.
 *
 * `key` es "sección.diseño", como en HOME_VARIANTS, más los tres de la portada de arriba.
 */
export function VariantSketch({ id }: { id: string }) {
  return (
    <span className="vs" aria-hidden="true">
      {SKETCHES[id] ?? null}
    </span>
  );
}

const grid = (columns: string, rows?: string, gap = 3): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: columns,
  gridTemplateRows: rows,
  gap,
  height: "100%",
});

const Box = ({ style, className = "" }: { style?: CSSProperties; className?: string }) => (
  <i className={`vs-box ${className}`} style={style} />
);

const many = (count: number, render: (index: number) => ReactNode) => Array.from({ length: count }, (_, index) => render(index));

const SKETCHES: Record<string, ReactNode> = {
  "hero.collage": (
    <span style={grid("repeat(5, 1fr)", undefined, 2)}>
      {many(5, (index) => (
        <Box key={index} className="vs-photo" />
      ))}
    </span>
  ),
  "hero.photo": <Box className="vs-photo" style={{ height: "100%" }} />,
  "hero.text": (
    <span className="vs-center">
      <i className="vs-line vs-line-strong" style={{ width: "62%" }} />
      <i className="vs-line" style={{ width: "40%" }} />
    </span>
  ),

  "services.cards": (
    <span style={grid("repeat(4, 1fr)")}>
      {many(4, (index) => (
        <span key={index} className="vs-card">
          <i className="vs-fill" />
        </span>
      ))}
    </span>
  ),
  "services.list": (
    <span style={grid("1fr 1fr", "repeat(3, 1fr)", 2)}>
      {many(6, (index) => (
        <span key={index} className="vs-row">
          <i className="vs-dot" />
          <i className="vs-line" />
        </span>
      ))}
    </span>
  ),
  "services.mosaic": (
    <span style={grid("2fr 1fr 1fr", "1fr 1fr")}>
      <Box className="vs-fill" style={{ gridRow: "span 2" }} />
      {many(4, (index) => (
        <Box key={index} className="vs-fill vs-soft" />
      ))}
    </span>
  ),

  "gallery.carousel": (
    <span style={grid("1fr 2.2fr 1fr", undefined, 4)}>
      <Box className="vs-photo vs-faded" style={{ margin: "14% 0" }} />
      <Box className="vs-photo" />
      <Box className="vs-photo vs-faded" style={{ margin: "14% 0" }} />
    </span>
  ),
  "gallery.grid": (
    <span style={grid("2fr 1fr 1fr", "1fr 1fr")}>
      <Box className="vs-photo" style={{ gridRow: "span 2" }} />
      {many(4, (index) => (
        <Box key={index} className="vs-photo" />
      ))}
    </span>
  ),
  "gallery.strip": (
    <span style={{ ...grid("repeat(4, 34%)"), overflow: "hidden" }}>
      {many(4, (index) => (
        <Box key={index} className="vs-photo" style={{ margin: "12% 0" }} />
      ))}
    </span>
  ),

  "yourSpace.cards": (
    <span style={grid("repeat(3, 1fr)")}>
      {many(3, (index) => (
        <span key={index} className="vs-card vs-pad">
          <i className="vs-dot" />
          <i className="vs-line" />
        </span>
      ))}
    </span>
  ),
  "yourSpace.list": (
    <span className="vs-card" style={grid("1fr", "repeat(3, 1fr)", 0)}>
      {many(3, (index) => (
        <span key={index} className="vs-row vs-ruled">
          <i className="vs-dot" />
          <i className="vs-line" />
        </span>
      ))}
    </span>
  ),
  "yourSpace.band": (
    <span className="vs-dark" style={grid("repeat(3, 1fr)", undefined, 6)}>
      {many(3, (index) => (
        <span key={index} className="vs-pad">
          <i className="vs-dot vs-light" />
          <i className="vs-line vs-light" />
        </span>
      ))}
    </span>
  ),

  "location.below": (
    <span style={grid("1fr", "auto 1fr", 4)}>
      <i className="vs-line vs-line-strong" style={{ width: "45%" }} />
      <Box className="vs-map" />
    </span>
  ),
  "location.split": (
    <span style={grid("1fr 1.5fr", undefined, 5)}>
      <span className="vs-stack">
        <i className="vs-line vs-line-strong" style={{ width: "80%" }} />
        <i className="vs-line" style={{ width: "60%" }} />
      </span>
      <Box className="vs-map" />
    </span>
  ),
  "location.overlay": (
    <span className="vs-map vs-layer">
      <span className="vs-card vs-pad vs-float">
        <i className="vs-line vs-line-strong" />
        <i className="vs-line" style={{ width: "70%" }} />
      </span>
    </span>
  ),

  "footer.full": (
    <span className="vs-dark" style={grid("repeat(3, 1fr)", undefined, 6)}>
      {many(3, (index) => (
        <span key={index} className="vs-stack vs-pad">
          <i className="vs-line vs-light" />
          <i className="vs-line vs-light" style={{ width: "70%" }} />
        </span>
      ))}
    </span>
  ),
  "footer.columns": (
    <span className="vs-dark" style={grid("1.3fr 1fr 1fr", undefined, 6)}>
      {many(3, (index) => (
        <span key={index} className="vs-stack vs-pad">
          <i className="vs-line vs-light vs-line-strong" style={{ width: "50%" }} />
          <i className="vs-rule" />
          <i className="vs-line vs-light" />
          <i className="vs-line vs-light" style={{ width: "70%" }} />
        </span>
      ))}
    </span>
  ),
  "footer.centered": (
    <span className="vs-dark vs-center">
      <i className="vs-dot vs-light" />
      <i className="vs-line vs-light" style={{ width: "60%" }} />
      <i className="vs-line vs-light" style={{ width: "40%" }} />
    </span>
  ),
};
