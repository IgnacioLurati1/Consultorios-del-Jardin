import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/** Una foto que llega antes que esto se muestra sin fundido: ver `markLoaded`. */
const FAST_MS = 250;

interface HomePhotoProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** La foto achicada, como data URI. Ver photoPreviews.ts. */
  preview: string;
  /** Clases del marco, no de la imagen: es el marco el que ocupa el lugar. */
  frameClassName?: string;
  /**
   * Mientras sea true, la foto espera detrás de la vista previa aunque ya haya bajado. Lo
   * usa la portada para que las cinco aparezcan juntas: ver Hero.
   */
  hold?: boolean;
  /** Avisa que la foto terminó de bajar. */
  onReady?: () => void;
}

/**
 * Una foto de la portada que aparece enseguida.
 *
 * Hasta que baja la foto de verdad se ve su vista previa, una versión de 24 px estirada y
 * apenas difuminada que viaja adentro del código. La primera vez que se entraba, en ese
 * rato se veía el fondo liso, un bloque oscuro en el celular. Cuando termina de bajar, la
 * foto aparece encima con un fundido lento.
 *
 * La vista previa es el fondo del marco y no un filtro sobre la imagen: así la foto real
 * puede fundirse sobre ella, y el difuminado no tiene que recalcularse en cada cuadro.
 */
export function HomePhoto({ preview, frameClassName, hold = false, onReady, onLoad, ...img }: HomePhotoProps) {
  const [loaded, setLoaded] = useState(false);
  const [instant, setInstant] = useState(false);
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const markLoaded = useCallback(() => {
    // Una foto que llega enseguida (de la caché, al recargar) aparece sin fundido. Con
    // fundido, cada recarga mostraba un instante la vista previa y después el cambio a la
    // foto: un parpadeo que no hacía falta, y más fuerte en el tema claro. El fundido queda
    // para cuando la foto tarda de verdad, que es cuando la vista previa sirve.
    const since = mountedAt.current === null ? 0 : performance.now() - mountedAt.current;
    if (since < FAST_MS) setInstant(true);
    setLoaded(true);
    onReady?.();
  }, [onReady]);

  // Si la foto ya estaba en la caché, puede terminar de cargar antes de que React escuche
  // el evento. `complete` lo cubre: sin esto quedaría invisible encima de la vista previa.
  const whenMounted = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) markLoaded();
    },
    [markLoaded]
  );

  return (
    <span
      // "home-pic-frame" y no "home-photo": ese nombre ya lo usa el ícono de las tarjetas de
      // especialidades, y sus reglas se mezclaban con estas.
      className={`home-pic-frame ${loaded && !hold ? "is-loaded" : ""} ${instant ? "is-instant" : ""} ${frameClassName ?? ""}`}
      // Una foto sin vista previa cargada no pide nada: queda el marco liso, como antes.
      style={preview ? { backgroundImage: `url("${preview}")` } : undefined}
    >
      <img
        {...img}
        ref={whenMounted}
        onLoad={(event) => {
          markLoaded();
          onLoad?.(event);
        }}
      />
    </span>
  );
}
