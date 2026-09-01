import { useEffect, useRef, useState } from "react";

/**
 * Marca un bloque como visible la primera vez que entra en pantalla, para que la
 * portada se vaya armando a medida que se baja. Se dispara una sola vez: volver a
 * subir no vuelve a animar nada.
 *
 * La animación en sí la hace el CSS, que también es quien respeta
 * `prefers-reduced-motion`. Acá solo se prende la clase.
 */
export function useFadeIn<T extends HTMLElement = HTMLDivElement>() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      // Un poco antes de que el bloque toque el borde: así ya está entrando animado
      // y no aparece de golpe justo cuando se lo mira.
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}
