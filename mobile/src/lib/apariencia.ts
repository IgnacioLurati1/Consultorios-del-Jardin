import { useEffect, useState } from "react";
import { secureStorage } from "../api/secureStorage";
import { SEASONS, SeasonChoice } from "../theme/season";

/**
 * Cómo se ve la app: claro u oscuro, y de qué color.
 *
 * Se guarda igual de local que "menos texto": en este teléfono y nada más. No viaja al
 * servidor ni se comparte entre dispositivos, porque no es un dato del consultorio sino
 * una preferencia de quien está mirando la pantalla.
 *
 * El valor se mantiene acá arriba, fuera de React, por los mismos dos motivos que aquel.
 * Leerlo del almacenamiento es asíncrono, así que sin una copia en memoria la app
 * arrancaría un instante con la paleta que no es. Y como se elige en un panel y lo que
 * cambia es toda la app, hace falta que cada pantalla se entere: de eso se ocupa la lista
 * de avisados.
 */
const KEY = "cdj.apariencia";

/** Claro, oscuro, o lo que tenga puesto el teléfono. */
export type ModeChoice = "auto" | "light" | "dark";

export interface Apariencia {
  mode: ModeChoice;
  season: SeasonChoice;
}

/**
 * Lo que vale para quien nunca tocó nada.
 *
 * El modo sigue al teléfono, que es lo que la app hizo siempre: alguien que puso el
 * celular en oscuro ya eligió. Y el color sigue al calendario, que es lo que tiene
 * gracia: la app acompaña al año sin que nadie haga nada.
 */
const DEFAULT: Apariencia = { mode: "auto", season: "auto" };

const avisar = new Set<(value: Apariencia) => void>();

let actual: Apariencia = DEFAULT;
let leido = false;

function sanitize(raw: unknown): Apariencia {
  const value = (raw ?? {}) as Partial<Apariencia>;

  return {
    mode: value.mode === "light" || value.mode === "dark" ? value.mode : "auto",
    season: SEASONS.some((season) => season.key === value.season) ? (value.season as SeasonChoice) : "auto",
  };
}

function cargar(): void {
  if (leido) return;
  leido = true;

  secureStorage
    .get(KEY)
    .then((raw) => {
      if (!raw) return;

      actual = sanitize(JSON.parse(raw));
      for (const notificar of avisar) notificar(actual);
    })
    .catch(() => {
      // Sin almacenamiento, o con lo guardado roto, queda lo que trae la app. No es una
      // falla que valga la pena contar: lo peor que pasa es que la pantalla se vea como
      // se veía antes de que alguien tocara nada.
    });
}

/** Lo elegido, y cómo cambiarlo. Lo segundo lo usa solo el panel de apariencia. */
export function useApariencia(): [Apariencia, (value: Apariencia) => void] {
  const [value, setValue] = useState(actual);

  useEffect(() => {
    avisar.add(setValue);
    cargar();
    setValue(actual);

    return () => {
      avisar.delete(setValue);
    };
  }, []);

  function cambiar(next: Apariencia) {
    actual = next;
    void secureStorage.set(KEY, JSON.stringify(next)).catch(() => {});
    for (const notificar of avisar) notificar(next);
  }

  return [value, cambiar];
}
