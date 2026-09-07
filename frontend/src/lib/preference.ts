import { useEffect, useState } from "react";
import { readCookie, writeCookie } from "./cookies";

/**
 * Una preferencia de lectura de la persona que mira, guardada en su navegador.
 *
 * Son cosas como "menos texto" o la vista simplificada: no cambian nada de lo que el
 * consultorio hace, solo cómo se ven las pantallas. Por eso no valen un viaje al backend
 * ni una columna en la base, y que no sigan a otra computadora no le hace mal a nadie.
 *
 * Cada preferencia lleva su propia lista de quienes la están mirando, porque nada avisa
 * cuando una cookie cambia: sin eso, el switch se prendería y el resto de la pantalla se
 * quedaría como estaba hasta el próximo refresco.
 */
export function createPreference(key: string) {
  const escuchando = new Set<(value: boolean) => void>();

  function leer(): boolean {
    try {
      return readCookie(key) === "1";
    } catch {
      // Navegador con el almacenamiento bloqueado. Se puede vivir sin la preferencia; no
      // se puede vivir con la pantalla rota por leerla.
      return false;
    }
  }

  /** El estado y cómo cambiarlo. Todos los que llamen a esto ven el mismo valor. */
  return function usePreference(): [boolean, (value: boolean) => void] {
    const [value, setValue] = useState(leer);

    useEffect(() => {
      escuchando.add(setValue);
      return () => {
        escuchando.delete(setValue);
      };
    }, []);

    function cambiar(next: boolean) {
      try {
        writeCookie(key, next ? "1" : "0");
      } catch {
        // No poder recordarlo para la próxima no es motivo para no aplicarlo ahora.
      }
      for (const avisar of escuchando) avisar(next);
    }

    return [value, cambiar];
  };
}
