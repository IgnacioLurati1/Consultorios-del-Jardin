import { useEffect, useRef, useState } from "react";
import { useSeason } from "../../context/SeasonContext";
import { useTheme } from "../../context/ThemeContext";
import "./entrance.css";

/** Quieto, alcanza con treinta cuadros; mientras la cámara se mueve, se dibuja a todos. */
const IDLE_FRAME_MS = 1000 / 30;

/**
 * Si ya se entró en esta visita. El paso hacia adentro se da una vez: cambiar de tema o de
 * estación arma la escena de nuevo, y repetir la entrada cada vez sería un mareo.
 */
let entered = false;

/**
 * El hall del consultorio en 3D, cubriendo el contenedor que lo envuelve. Ese contenedor
 * lleva la clase `entrance-host`, que es la que da el tamaño y deja el lienzo por detrás de
 * lo demás. Afuera se ve la estación del sitio, y en modo oscuro es de noche.
 *
 * Con `centered`, la puerta del jardín queda al medio: es para cuando no hay una tarjeta
 * adelante que la tape. Sin eso, en una pantalla ancha se corre a la derecha.
 *
 * La escena (y three.js con ella) se pide recién acá, con un import dinámico: el resto del
 * sitio no carga una librería 3D que solo usan estas pantallas, y lo que haya encima se puede
 * usar desde el primer momento, antes de que el fondo aparezca.
 *
 * Con "reducir movimiento" prendido queda un cuadro quieto, ya adentro. La pestaña en
 * segundo plano no dibuja. Y sin WebGL no hay fondo: queda lo que estaba debajo.
 */
export function EntranceCanvas({ centered = false }: { centered?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();
  const { season } = useSeason();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    // Sin ResizeObserver (las pruebas corren en jsdom) no hay fondo, y lo de encima anda igual.
    if (!canvas || !host || typeof ResizeObserver === "undefined") return;

    let cancelled = false;
    let cleanup = () => {};

    import("./entranceScene")
      .then(({ createEntrance }) => {
        if (cancelled) return;

        const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        const entrance = createEntrance(canvas, {
          season,
          night: theme === "dark",
          walkIn: !entered && !motion?.matches,
          centered,
        });
        if (!entrance) return;
        entered = true;

        let frame = 0;
        let last = 0;
        let busy = true;

        const loop = (now: number) => {
          frame = requestAnimationFrame(loop);
          if (!busy && now - last < IDLE_FRAME_MS) return;
          last = now;
          busy = entrance.render(now / 1000);
        };

        const start = () => {
          cancelAnimationFrame(frame);
          if (motion?.matches) entrance.renderStill();
          else frame = requestAnimationFrame(loop);
        };

        // El tamaño se toma del contenedor con el relleno incluido: el fondo llega hasta
        // los bordes, no hasta donde empieza el contenido.
        const observer = new ResizeObserver(() => {
          entrance.resize(host.clientWidth, host.clientHeight);
          if (motion?.matches) entrance.renderStill();
        });

        entrance.resize(host.clientWidth, host.clientHeight);
        observer.observe(host);
        motion?.addEventListener?.("change", start);
        start();
        setReady(true);

        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          motion?.removeEventListener?.("change", start);
          entrance.dispose();
        };
      })
      .catch(() => {
        // Sin la escena, la página queda lisa. No es algo que valga la pena contarle a nadie.
      });

    return () => {
      cancelled = true;
      cleanup();
      setReady(false);
    };
  }, [season, theme, centered]);

  return (
    <>
      {/* Un lienzo nuevo por cada estación y tema: al desarmar una escena se suelta su
          contexto WebGL, y un lienzo que ya soltó el suyo no vuelve a dibujar. Con el mismo
          elemento, el fondo desaparecía apenas se cambiaba la estación o el modo. */}
      <canvas
        key={`${season}-${theme}`}
        ref={canvasRef}
        className={`entrance-backdrop ${ready ? "is-ready" : ""}`}
        aria-hidden="true"
      />
      <div className={`entrance-veil ${ready ? "is-ready" : ""}`} aria-hidden="true" />
    </>
  );
}
