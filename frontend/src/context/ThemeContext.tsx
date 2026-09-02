import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { readJsonCookie, writeJsonCookie } from "../lib/cookies";

const COOKIE = "tema";

/**
 * Claro, oscuro, o que lo decida el reloj.
 *
 * El horario existe porque el motivo más común para querer la pantalla oscura no es el
 * gusto sino la hora: a las once de la noche molesta, a las diez de la mañana no se lee.
 * Que haya que acordarse de cambiarlo dos veces por día es la manera de que nadie lo use.
 */
export type ThemeMode = "light" | "dark" | "schedule";

export interface ThemePreference {
  mode: ThemeMode;
  /** Desde qué hora se pone oscuro, en modo horario. "HH:MM". */
  from: string;
  /** Hasta qué hora. Puede ser menor que `from`: eso es un rango que cruza la medianoche. */
  to: string;
}

/**
 * Lo que vale para quien nunca tocó nada: el horario, prendido.
 *
 * Se elige por defecto y no en claro fijo porque el caso que resuelve es el de siempre —
 * de noche la pantalla blanca molesta— y porque nadie va a ir a buscar la opción atrás
 * de un engranaje. El que no lo quiera lo apaga con un click y la cookie se acuerda.
 */
const DEFAULT: ThemePreference = { mode: "schedule", from: "20:00", to: "07:00" };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/**
 * Si `now` cae dentro del rango.
 *
 * De 20:00 a 07:00 el rango cruza la medianoche, así que el final es menor que el
 * arranque y la pregunta se da vuelta: adentro es "después del arranque **o** antes del
 * final", en vez de "después del arranque **y** antes del final".
 */
export function inRange(now: Date, from: string, to: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutes(from);
  const end = minutes(to);

  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function resolveTheme(preference: ThemePreference, now = new Date()): "light" | "dark" {
  if (preference.mode !== "schedule") return preference.mode;
  return inRange(now, preference.from, preference.to) ? "dark" : "light";
}

function sanitize(value: ThemePreference): ThemePreference {
  return {
    mode: value.mode === "dark" || value.mode === "schedule" ? value.mode : "light",
    from: TIME.test(value.from) ? value.from : DEFAULT.from,
    to: TIME.test(value.to) ? value.to : DEFAULT.to,
  };
}

interface ThemeContextValue {
  preference: ThemePreference;
  /** Lo que se está viendo ahora mismo, ya resuelto el horario. */
  theme: "light" | "dark";
  /** Pasa de claro a oscuro y al revés. Si estaba en horario, lo saca del horario. */
  toggle: () => void;
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setStored] = useState<ThemePreference>(() => sanitize(readJsonCookie(COOKIE, DEFAULT)));
  const [theme, setTheme] = useState<"light" | "dark">(() => resolveTheme(sanitize(readJsonCookie(COOKIE, DEFAULT))));

  const setPreference = useCallback((value: ThemePreference) => {
    const clean = sanitize(value);
    setStored(clean);
    writeJsonCookie(COOKIE, clean);
    setTheme(resolveTheme(clean));
  }, []);

  const toggle = useCallback(() => {
    setPreference({ ...preference, mode: theme === "dark" ? "light" : "dark" });
  }, [preference, theme, setPreference]);

  // En modo horario el tema cambia sin que nadie toque nada, así que hay que mirar el
  // reloj. Cada medio minuto: el borde del rango se cruza con un minuto de precisión y
  // preguntar la hora no cuesta nada.
  useEffect(() => {
    if (preference.mode !== "schedule") return;

    const tick = () => setTheme(resolveTheme(preference));
    tick();

    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [preference]);

  // El atributo va en <html> y no en un div: el fondo de la página lo pinta el navegador
  // desde ahí, y las ventanas modales viven fuera del árbol de la app.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo(() => ({ preference, theme, toggle, setPreference }), [preference, theme, toggle, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme se usa adentro de ThemeProvider");
  return context;
};
