import { useEffect, useState } from "react";
import { readCookie, writeCookie } from "./cookies";

/**
 * Si las pantallas se muestran con las explicaciones o sin ellas.
 *
 * Es una preferencia de lectura de la persona que mira, así que vive en su navegador y
 * no en el servidor: no vale un viaje al backend ni una columna en la base, y que no la
 * siga a otra computadora no le hace mal a nadie. Va en una cookie y no en otro lado
 * porque es donde ya viven las otras preferencias —el tema, los avisos leídos—, y tener
 * dos formas de guardar lo mismo es una de más.
 */
const KEY = "menos-texto";

/*
 * Los que están mirando el valor ahora mismo.
 *
 * Nada avisa cuando una cookie cambia, así que sin esta lista el switch se prendería y
 * el resto de la pantalla se quedaría con el texto largo hasta el próximo refresco.
 */
const escuchando = new Set<(value: boolean) => void>();

function leer(): boolean {
  try {
    return readCookie(KEY) === "1";
  } catch {
    // Navegador con el almacenamiento bloqueado. Se puede vivir sin la preferencia; no
    // se puede vivir con la pantalla rota por leerla.
    return false;
  }
}

/**
 * El estado y cómo cambiarlo. Todos los que llamen a esto ven el mismo valor.
 *
 * Lo que apaga son las descripciones que repiten lo que el título ya dice. Lo que avisa
 * qué se toca y qué no, y lo que lleva un dato adentro, se queda siempre: eso no es
 * texto de más, es la diferencia entre entender y no entender qué va a pasar.
 */
export function useSimpleText(): [boolean, (value: boolean) => void] {
  const [simple, setSimple] = useState(leer);

  useEffect(() => {
    escuchando.add(setSimple);
    return () => {
      escuchando.delete(setSimple);
    };
  }, []);

  function cambiar(value: boolean) {
    try {
      writeCookie(KEY, value ? "1" : "0");
    } catch {
      // No poder recordarlo para la próxima no es motivo para no aplicarlo ahora.
    }
    for (const avisar of escuchando) avisar(value);
  }

  return [simple, cambiar];
}
