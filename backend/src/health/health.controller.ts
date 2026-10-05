import { Request, Response, NextFunction } from "express";
import { getHealth } from "./health.service.js";

/**
 * CORS de la ruta de salud, y solo de ella.
 *
 * Se lee desde cualquier lado: la tarea de GitHub (que no es un navegador y no lo
 * necesita) y la consola del dueño, que corre en otro dominio. `*` sin credenciales es lo
 * correcto acá: no hay cookie ni token que proteger, y el navegador no manda ninguno a un
 * origen que contesta `*`.
 *
 * Por eso el router se monta en app.ts antes que el CORS general, y contesta él mismo. El
 * CORS general rechaza con error a un origen que no está en WEB_ORIGIN, y eso es lo que
 * tiene que seguir haciendo en todas las demás rutas.
 */
export function healthCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // Nunca una lista de encabezados ni credenciales: esta ruta no recibe ninguno de los dos.
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "600");
    return res.status(204).end();
  }
  return next();
}

/** El estado del servidor. 503 si la base no contesta; 200 en todo lo demás. */
export async function health(_req: Request, res: Response) {
  // Que ningún proxy ni el navegador guarde la respuesta: un estado viejo es peor que ninguno.
  res.setHeader("Cache-Control", "no-store");

  try {
    const report = await getHealth();
    return res.status(report.db === "ok" ? 200 : 503).json(report);
  } catch {
    // Express 4 no atrapa el rechazo de una función async: sin esto la request queda colgada.
    return res.status(503).json({ ok: false, time: new Date().toISOString(), version: null, db: "error", jobs: null });
  }
}
