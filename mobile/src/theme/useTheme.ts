import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { useApariencia } from "../lib/apariencia";
import { Season, seasonOf } from "./season";
import { Band, bandFor, Colors, paletteFor } from "./tokens";

export interface Theme {
  colors: Colors;
  /** El encabezado de Inicio, que es el único degradado de la app. */
  band: Band;
  dark: boolean;
  season: Season;
}

/**
 * De qué color está la app en este momento.
 *
 * Por defecto sigue al teléfono para el claro y el oscuro, y al calendario para el color.
 * Las dos cosas se pueden fijar a mano desde el panel de Inicio, y eso es lo único que
 * este gancho hace además de leer la paleta.
 *
 * La estación se calcula en cada render y no una sola vez al arrancar: es una cuenta de
 * dos restas, y así una app que quedó abierta desde ayer no se queda en la estación de
 * ayer. La paleta que sale de eso viene hecha de antes.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const [apariencia] = useApariencia();

  const dark = apariencia.mode === "auto" ? scheme === "dark" : apariencia.mode === "dark";
  const season = apariencia.season === "auto" ? seasonOf(new Date()) : apariencia.season;

  return useMemo(
    () => ({ colors: paletteFor(season, dark), band: bandFor(season), dark, season }),
    [season, dark]
  );
}
