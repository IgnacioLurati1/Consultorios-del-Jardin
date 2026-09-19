import { useEffect, useState } from "react";
import { holidayOf, type Holiday } from "../../lib/holidays";

/**
 * Qué se está festejando, para que la portada se adorne sola.
 *
 * Pregunta una vez por hora, igual que la estación: los rangos duran días, así que
 * alcanza de sobra para la pestaña que quedó abierta la noche del 30 de noviembre.
 */
export function useHoliday(): Holiday | null {
  const [holiday, setHoliday] = useState<Holiday | null>(() => holidayOf(new Date()));

  useEffect(() => {
    const tick = () => setHoliday(holidayOf(new Date()));
    tick();

    const timer = window.setInterval(tick, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return holiday;
}
