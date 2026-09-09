import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { readCookie, writeCookie } from "../lib/cookies";

const COOKIE = "estacion";

export type Season = "otono" | "invierno" | "primavera" | "verano";

/** La estación que se está mostrando, o que la decida el calendario. */
export type SeasonChoice = Season | "auto";

/**
 * Las cuatro, en el orden del calendario de acá: el año arranca en verano.
 *
 * No dice de qué color es cada una porque al lado de cada nombre está la muestra, y
 * escribir "marrón" al lado de un cuadrado marrón no agrega nada.
 */
export const SEASONS: { key: Season; label: string }[] = [
  { key: "verano", label: "Verano" },
  { key: "otono", label: "Otoño" },
  { key: "invierno", label: "Invierno" },
  { key: "primavera", label: "Primavera" },
];

/**
 * Argentina está en UTC-3 todo el año, sin horario de verano desde 2009.
 *
 * Se resta la diferencia a mano y se lee en UTC en vez de preguntarle la fecha al
 * navegador. La estación es del consultorio, no de quien mira: alguien que abre la página
 * desde otro huso —de viaje, o con el reloj de la máquina mal puesto— tiene que ver el
 * mismo otoño que se ve acá.
 */
const ARGENTINA = -3 * 60 * 60 * 1000;

/**
 * En qué estación cae una fecha, en el hemisferio sur.
 *
 * Los cortes son los astronómicos, redondeados al 21: el día exacto se mueve unas horas
 * de un año a otro y nadie va a notar que el color cambió un día después.
 */
export function seasonOf(now: Date): Season {
  const argentina = new Date(now.getTime() + ARGENTINA);

  // Mes y día en un solo número, para poder comparar rangos sin dos condiciones por
  // estación. El 21 de marzo es 321, el 21 de diciembre es 1221.
  const date = (argentina.getUTCMonth() + 1) * 100 + argentina.getUTCDate();

  if (date >= 321 && date < 621) return "otono";
  if (date >= 621 && date < 921) return "invierno";
  if (date >= 921 && date < 1221) return "primavera";
  return "verano";
}

/**
 * La que sigue en el calendario, para el botón de cambio rápido de la barra.
 *
 * Da la vuelta: después de primavera viene verano otra vez. Cuatro toques y volvés a
 * donde estabas, que es lo que hace que se pueda probar sin miedo a perder de vista cuál
 * era la de ahora.
 */
export function nextSeason(season: Season): Season {
  const index = SEASONS.findIndex((option) => option.key === season);
  return SEASONS[(index + 1) % SEASONS.length].key;
}

function sanitize(value: string | null): SeasonChoice {
  if (value === "auto") return "auto";
  return SEASONS.some((season) => season.key === value) ? (value as Season) : "auto";
}

interface SeasonContextValue {
  /** Lo elegido: una estación fija, o "auto" para que la decida el calendario. */
  choice: SeasonChoice;
  /** La que se está viendo, ya resuelto el automático. */
  season: Season;
  setChoice: (value: SeasonChoice) => void;
}

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined);

/**
 * De qué color está la página.
 *
 * El automático viene puesto porque es el que tiene gracia: la página acompaña al año
 * sin que nadie haga nada, y cuatro veces al año se ve distinta al abrirla. El que lo
 * quiera quieto elige una estación y la cookie se acuerda.
 *
 * Vive solo acá adelante. No es un dato del consultorio sino de quien mira, así que no
 * viaja al servidor ni se comparte entre equipos, igual que el modo oscuro.
 */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const [choice, setStored] = useState<SeasonChoice>(() => sanitize(readCookie(COOKIE)));
  const [automatic, setAutomatic] = useState<Season>(() => seasonOf(new Date()));

  const setChoice = useCallback((value: SeasonChoice) => {
    setStored(value);
    writeCookie(COOKIE, value);
  }, []);

  // La estación cambia cuatro veces al año, así que preguntar una vez por hora sobra y
  // no cuesta nada. Es para la pestaña que quedó abierta la noche del 20 de septiembre.
  useEffect(() => {
    if (choice !== "auto") return;

    const tick = () => setAutomatic(seasonOf(new Date()));
    tick();

    const timer = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [choice]);

  const season = choice === "auto" ? automatic : choice;

  // Va en <html>, al lado de data-theme y por el mismo motivo: el fondo de la página lo
  // pinta el navegador desde ahí, y las ventanas modales viven fuera del árbol de la app.
  useEffect(() => {
    document.documentElement.setAttribute("data-season", season);
  }, [season]);

  const value = useMemo(() => ({ choice, season, setChoice }), [choice, season, setChoice]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (!context) throw new Error("useSeason se usa adentro de SeasonProvider");
  return context;
};
