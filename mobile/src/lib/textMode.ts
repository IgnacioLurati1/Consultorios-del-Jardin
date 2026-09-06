import { useEffect, useState } from "react";
import { secureStorage } from "../api/secureStorage";

/**
 * "Menos texto": las explicaciones se apagan y queda solo el nombre de cada cosa.
 *
 * Es lo mismo que hay en la web, y se guarda igual de local: en este teléfono y nada
 * más. No viaja al servidor ni se comparte entre dispositivos, porque no es un dato del
 * consultorio sino una preferencia de lectura de quien está mirando la pantalla.
 *
 * El valor se mantiene acá arriba, fuera de React, por dos motivos. Leerlo del
 * almacenamiento es asíncrono, así que sin una copia en memoria cada pantalla que se
 * abre parpadearía con las descripciones puestas antes de sacarlas. Y como el switch
 * vive en una pantalla y lo que cambia está en otras, hace falta que todas se enteren:
 * de eso se ocupa la lista de avisados.
 */
const KEY = "cdj.menos-texto";

const avisar = new Set<(value: boolean) => void>();

let simple = false;
let leido = false;

function cargar(): void {
  if (leido) return;
  leido = true;

  secureStorage
    .get(KEY)
    .then((raw) => {
      simple = raw === "1";
      for (const notificar of avisar) notificar(simple);
    })
    .catch(() => {
      // Sin almacenamiento se queda en el texto completo, que es lo que trae la app.
    });
}

/** Si está prendido, y cómo cambiarlo. Lo segundo solo lo usa el switch del panel. */
export function useSimpleText(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(simple);

  useEffect(() => {
    avisar.add(setValue);
    cargar();
    setValue(simple);

    return () => {
      avisar.delete(setValue);
    };
  }, []);

  function cambiar(next: boolean) {
    simple = next;
    void secureStorage.set(KEY, next ? "1" : "0").catch(() => {});
    for (const notificar of avisar) notificar(next);
  }

  return [value, cambiar];
}
