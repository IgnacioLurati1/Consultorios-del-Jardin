import type { ReactNode } from "react";
import type { Holiday } from "../../lib/holidays";
import { useHoliday } from "./useHoliday";
import "./decor.css";

/**
 * La guirnalda de las fechas especiales, colgada del borde de arriba de la pantalla.
 *
 * Es eso y nada más: un adorno. Los colores de la página los sigue poniendo la estación,
 * que es lo que da el clima del año; esto se cuelga encima unos días y después se va.
 *
 * Va arriba de la portada, del ingreso, del registro y de los paneles. Se ubica contra el
 * primer contenedor posicionado que la tenga adentro, a todo su ancho:
 * - En la portada y en el ingreso ese contenedor ya existe.
 * - En los paneles la página es angosta y centrada, así que va con `row`: una fila del
 *   ancho de la pantalla, de la que cuelga más chica. Corre el contenido apenas, para no
 *   tapar el título.
 * - Fuera de la portada va más chica (`compact`): ahí es un detalle, no la protagonista.
 *
 * El dibujo se repite a lo largo con un `pattern` de SVG en vez de estirarse, así se ve
 * igual de grande en una pantalla angosta que en una ancha. Todo es dibujo, sin imágenes
 * que bajar.
 *
 * Los adornos chicos de la portada —al lado de cada título y en el borde del pie— viven
 * en decor.css, colgados del atributo `data-holiday` de la portada.
 */

/** Ancho de lo que se repite, y alto de la franja colgada. */
const TILE = 240;
const TALL = 112;

const PINE_DARK = "#1c4d32";
const PINE = "#2f7a4c";
const PINE_LIGHT = "#4a9c62";
const RED = "#b3372b";
const GOLD = "#d8a13a";
const CREAM = "#fefae0";

export function HolidayGarland({ row = false, compact = row }: { row?: boolean; compact?: boolean }) {
  const holiday = useHoliday();
  if (!holiday) return null;

  const id = `holiday-garland-${holiday}`;
  const garland = (
    <div className={`holiday-garland ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <svg width="100%" height={TALL} focusable="false">
        <defs>
          <pattern id={id} width={TILE} height={TALL} patternUnits="userSpaceOnUse">
            {TILES[holiday]}
          </pattern>
        </defs>
        <rect width="100%" height={TALL} fill={`url(#${id})`} />
      </svg>
    </div>
  );

  return row ? <div className="holiday-garland-row">{garland}</div> : garland;
}

/** Lo que va en la unión entre un tramo y el siguiente: la mitad en cada punta del
    dibujo, que el patrón junta en uno solo. Se dibuja centrado en x = 0. */
function atSeam(node: ReactNode) {
  return (
    <>
      {node}
      <g transform={`translate(${TILE} 0)`}>{node}</g>
    </>
  );
}

/* ---------------- navidad ---------------- */

/** La curva de la que cuelga todo, con sus cuatro puntos. Arranca y termina a la misma
    altura, así el dibujo empalma con el siguiente. */
const SWAG: [number, number][] = [
  [0, 12],
  [60, 64],
  [180, 64],
  [240, 12],
];

/** Un punto de la curva y hacia dónde va, para `t` entre 0 y 1. */
function along(t: number) {
  const [p0, p1, p2, p3] = SWAG;
  const u = 1 - t;
  const at = (i: 0 | 1) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  const slope = (i: 0 | 1) => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]);
  const dx = slope(0);
  const dy = slope(1);
  const size = Math.hypot(dx, dy) || 1;
  return { x: at(0), y: at(1), dx: dx / size, dy: dy / size };
}

/**
 * Las agujas del pino: rayitas cortas que salen de la rama para los dos lados, un poco
 * hacia atrás, en tres verdes. Se calculan una vez; el azar tiene semilla fija para que
 * la guirnalda salga igual cada vez que se abre la página.
 */
function pineNeedles() {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const shades = ["", "", ""];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const { x, y, dx, dy } = along(i / steps);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        // Entre 115 y 150 grados de la marcha: hacia afuera y un poco para atrás.
        const angle = (side * (115 + random() * 35) * Math.PI) / 180;
        const length = 8 + random() * 7;
        const nx = (dx * Math.cos(angle) - dy * Math.sin(angle)) * length;
        const ny = (dx * Math.sin(angle) + dy * Math.cos(angle)) * length;
        const shade = Math.floor(random() * 3);
        shades[shade] += `M${x.toFixed(1)} ${y.toFixed(1)}l${nx.toFixed(1)} ${ny.toFixed(1)}`;
      }
    }
  }
  return shades;
}

const NEEDLES = pineNeedles();

function Pine() {
  const [p0, p1, p2, p3] = SWAG;
  return (
    <g strokeLinecap="round" fill="none">
      <path d={`M${p0} C ${p1}, ${p2}, ${p3}`} stroke="#5a3b25" strokeWidth="3" />
      <path d={NEEDLES[0]} stroke={PINE_DARK} strokeWidth="2.6" />
      <path d={NEEDLES[1]} stroke={PINE} strokeWidth="2.3" />
      <path d={NEEDLES[2]} stroke={PINE_LIGHT} strokeWidth="1.9" />
    </g>
  );
}

/** Una bola colgando de un hilo, desde un punto de la guirnalda. */
function bauble(t: number, drop: number, r: number, color: string) {
  const { x, y } = along(t);
  const cy = y + drop + r + 1;

  return (
    <g key={`b${t}`}>
      <line x1={x} y1={y} x2={x} y2={y + drop} stroke={GOLD} strokeWidth="1.3" opacity="0.8" />
      <rect x={x - 2.6} y={y + drop - 3} width="5.2" height="5" rx="1.4" fill={GOLD} />
      <circle cx={x} cy={cy} r={r} fill={color} />
      <circle cx={x - r * 0.34} cy={cy - r * 0.38} r={r * 0.22} fill="#ffffff" opacity="0.42" />
    </g>
  );
}

/** Tres frutitos rojos juntos, de los que salpican el pino. */
function berries(t: number) {
  const { x, y } = along(t);
  return (
    <g key={`f${t}`} fill={RED}>
      <circle cx={x} cy={y - 1} r="2.8" />
      <circle cx={x + 5} cy={y + 2.6} r="2.5" />
      <circle cx={x - 4.6} cy={y + 3} r="2.3" />
    </g>
  );
}

/** El moño rojo donde la guirnalda se sujeta, centrado en x = 0. */
const BOW = (
  <g transform="translate(0 12)">
    <path d="M0 0 l-4 16 l4 -3 l4 3 z" fill="#962b21" />
    <path d="M0 0 C -6 -9, -17 -6, -14 1 C -12 6, -5 3, 0 0 Z" fill={RED} />
    <path d="M0 0 C 6 -9, 17 -6, 14 1 C 12 6, 5 3, 0 0 Z" fill={RED} />
    <circle r="3.4" fill="#962b21" />
  </g>
);

const NAVIDAD = (
  <>
    {/* Cada tramo pisa un poco a los vecinos: las agujas que salen del borde del dibujo
        las pone la copia de al lado, y no queda un corte recto en cada unión. */}
    <Pine />
    <g transform={`translate(${-TILE} 0)`}>
      <Pine />
    </g>
    <g transform={`translate(${TILE} 0)`}>
      <Pine />
    </g>

    {berries(0.3)}
    {berries(0.7)}

    {bauble(0.22, 14, 9, RED)}
    {bauble(0.5, 26, 11, GOLD)}
    {bauble(0.78, 11, 8, CREAM)}

    {/* El moño tapa la unión, donde la guirnalda se sujeta. */}
    {atSeam(BOW)}
  </>
);

/* ---------------- carnaval ---------------- */

const PAPEL = ["#e0563f", "#f2b134", "#2fb4a6", "#d8558f"];

/** Un cuadro de papel picado, con el borde de abajo en zigzag y los huecos calados. */
function papel(x: number, y: number, tilt: number, color: string) {
  const w = 46;
  const h = 42;
  const half = w / 2;
  const step = (w / 6).toFixed(2);

  // El zigzag del borde de abajo: seis tramos que suben y bajan y terminan donde
  // empezaron, para volver al costado izquierdo a la misma altura.
  const zig = ` l-${step} 6 l-${step} -6`.repeat(3);
  const body = `M${-half} 0 h${w} v${h - 6} ${zig} Z`;

  // Los huecos van en el mismo trazo y con `evenodd` quedan calados de verdad, así se ve
  // la foto a través del papel.
  const hole = (cx: number, cy: number, r: number) =>
    `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

  return (
    <g key={`p${x}`} transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <path d={`${body} ${hole(0, 13, 5.4)} ${hole(-11, 25, 3.4)} ${hole(11, 25, 3.4)}`} fill={color} fillRule="evenodd" />
    </g>
  );
}

/** Una serpentina desenrollada, colgando del hilo. */
function serpentina(x: number, y: number, color: string) {
  return (
    <path
      key={`s${x}`}
      d={`M${x} ${y} c 9 9 -9 17 0 26 c 9 9 -9 16 0 24`}
      fill="none"
      stroke={color}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
  );
}

const CARNAVAL = (
  <>
    <path d="M0 8 C 60 40, 180 40, 240 8" fill="none" stroke="#e7dcc2" strokeWidth="2" strokeLinecap="round" opacity="0.9" />

    {serpentina(56, 23, "#5f8dea")}
    {serpentina(184, 23, "#d8558f")}

    {papel(25, 13, -5, PAPEL[0])}
    {papel(86, 28, 4, PAPEL[1])}
    {papel(154, 28, -3, PAPEL[2])}
    {papel(215, 13, 6, PAPEL[3])}

    {/* Un pompón de papel donde se ata el hilo. */}
    {atSeam(
      <g transform="translate(0 8)">
        <circle r="6.5" fill="#5f8dea" />
        <circle r="3" fill="#f2b134" />
      </g>
    )}
  </>
);

/* ---------------- pascua ---------------- */

const BRANCH = "M0 12 C 60 34, 180 34, 240 12";

/** Un huevo pintado, colgando de un hilo. `deco` es lo que lleva encima. */
function egg(x: number, y: number, drop: number, color: string, deco: ReactNode) {
  const cy = y + drop + 15;

  return (
    <g key={`h${x}`}>
      <line x1={x} y1={y} x2={x} y2={y + drop + 2} stroke="#a58a6a" strokeWidth="1.2" />
      <g transform={`translate(${x} ${cy})`}>
        <path
          d="M0 -14 C 8 -14, 12 -4, 12 3 C 12 10.5, 6.6 16, 0 16 C -6.6 16, -12 10.5, -12 3 C -12 -4, -8 -14, 0 -14 Z"
          fill={color}
        />
        {deco}
      </g>
    </g>
  );
}

/** Una hoja sobre la rama, del lado que se le diga. */
function leaf(x: number, y: number, tilt: number) {
  return <path key={`l${x}`} d="M0 0 q 7 -5 12 0 q -5 5 -12 0" fill="#7fae5a" transform={`translate(${x} ${y}) rotate(${tilt})`} />;
}

const PINTURA = "#ffffff";

const PASCUA = (
  <>
    <path d={BRANCH} fill="none" stroke="#6b4b33" strokeWidth="4.5" strokeLinecap="round" />

    {leaf(28, 21, 18)}
    {leaf(96, 30, -14)}
    {leaf(148, 31, 12)}
    {leaf(206, 21, -20)}

    {/* Donde se cruzan las ramas, dos hojas y una flor chica. */}
    {atSeam(
      <g transform="translate(0 12)">
        <path d="M0 0 q -9 -8 -16 -2 q 7 6 16 2" fill="#7fae5a" />
        <path d="M0 0 q 9 -8 16 -2 q -7 6 -16 2" fill="#6a9a4a" />
        <g fill="#fefae0">
          <circle cx="0" cy="-4" r="2.6" />
          <circle cx="3.8" cy="-1.2" r="2.6" />
          <circle cx="2.4" cy="3.2" r="2.6" />
          <circle cx="-2.4" cy="3.2" r="2.6" />
          <circle cx="-3.8" cy="-1.2" r="2.6" />
        </g>
        <circle r="2" fill="#f6d46b" />
      </g>
    )}

    {egg(
      54,
      19,
      18,
      "#f4a58f",
      <path d="M-10.6 0 q 10.6 5 21.2 0 M-11.4 -6 q 11.4 4.5 22.8 0" fill="none" stroke={PINTURA} strokeWidth="2.2" opacity="0.7" />
    )}
    {egg(
      120,
      27,
      26,
      "#9fd3bf",
      <g fill={PINTURA} opacity="0.75">
        <circle cx="-5" cy="-4" r="1.9" />
        <circle cx="4.5" cy="-6" r="1.7" />
        <circle cx="0" cy="3" r="2" />
        <circle cx="-6" cy="8" r="1.7" />
        <circle cx="6" cy="6" r="1.9" />
      </g>
    )}
    {egg(
      186,
      19,
      14,
      "#f6d46b",
      <path d="M-10.4 2 l5.2 -4.4 l5.2 4.4 l5.2 -4.4 l5.2 4.4" fill="none" stroke="#c98a3c" strokeWidth="2.2" opacity="0.8" />
    )}
  </>
);

const TILES: Record<Holiday, ReactNode> = {
  navidad: NAVIDAD,
  carnaval: CARNAVAL,
  pascua: PASCUA,
};
