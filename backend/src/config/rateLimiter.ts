import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

/**
 * En desarrollo los topes se multiplican por veinte.
 *
 * El límite es por IP, y en la máquina de desarrollo la web, la app y el navegador con
 * Swagger son todos la misma IP: entre las tres se comen quinientas requests en un rato
 * de trabajo. Cuando eso pasa el servidor contesta 429 a todo y parece que se cayó, que
 * es la peor forma de enterarse.
 *
 * No se apaga del todo a propósito: así el camino del limitador se sigue ejecutando y un
 * error de configuración aparece acá y no recién en producción.
 */
const RELAX = process.env.NODE_ENV === "production" ? 1 : 20;

/**
 * Cortar a alguien queda escrito en el log de la plataforma.
 *
 * Sin esto, que a un limitador se le pase alguien no deja ningún rastro: la persona ve un
 * 429 y ahí muere. Y el caso que importa no es el de quien tipeó mal la contraseña, sino
 * el de la misma dirección golpeando toda la tarde, que solo se ve mirando el conjunto.
 *
 * Se anota una vez por dirección y limitador dentro de cada ventana, no una por request:
 * si no, el primero que decida hacer ruido escribe el log entero y tapa todo lo demás
 * —que es, además, una forma barata de esconder lo que vino después—.
 */
const announced = new Map<string, number>();

function announceOnce(key: string, windowMs: number, write: () => void): void {
  const now = Date.now();
  const last = announced.get(key);

  if (last !== undefined && now - last < windowMs) return;

  announced.set(key, now);
  write();

  // La limpieza va acá y no en un temporizador: el mapa solo crece cuando alguien está
  // siendo cortado, y en ese momento ya estamos haciendo trabajo.
  if (announced.size > 500) {
    for (const [k, at] of announced) if (now - at > windowMs) announced.delete(k);
  }
}

/** El mismo 429 de siempre, con una línea en el log. */
function announce(name: string, windowMs: number) {
  return (req: Request, res: Response, _next: NextFunction, options: any) => {
    const ip = req.ip ?? "dirección desconocida";
    const path = (req.originalUrl ?? req.url ?? "").split("?")[0];

    announceOnce(`${name} ${ip}`, windowMs, () =>
      console.warn(`LIMITE: ${name} cortó a ${ip} (${req.method} ${path})`)
    );

    res.status(options.statusCode).json(options.message);
  };
}

/**
 * Los cuatro contestan bajo la clave `message`, que es la que lee el front en cada
 * pantalla. Con cualquier otra la persona veía el texto en inglés que arma axios solo
 * —"Request failed with status code 429"— en lugar de lo que dice acá.
 */

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  handler: announce("el limitador general", 15 * 60 * 1000),
  max: 500 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes, intentá más tarde.' },
});

// Diez intentos por minuto y por IP. La ventana corta es deliberada: frena de igual
// forma a quien prueba contraseñas —que necesita miles, no diez— pero a alguien que se
// equivocó de tecla lo deja reintentando en menos de lo que tarda en releer el mail,
// en vez de dejarlo afuera diez minutos. La misma ventana cubre renovar la sesión, que
// desde una red compartida son varias personas sumando contra la misma IP.
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // ventana de 1 minuto
  handler: announce("el limitador de autenticación", 60 * 1000),
  max: 10 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Probaste varias veces seguidas. Esperá un minuto y volvé a intentar.' },
});

// Consultas de solo lectura sin sesión (¿este email ya tiene cuenta?). Es más
// permisivo que authLimiter porque el registro lo llama mientras se escribe, pero
// sigue estando acotado: si no, sería una forma cómoda de averiguar qué emails
// están registrados.
const lookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  handler: announce("el limitador de consultas de email", 10 * 60 * 1000),
  max: 60 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas consultas, intentá más tarde.' },
});

// Formulario de contacto. Cada envío dispara mails de verdad, así que es la ruta
// pública más cara de abusar: se permiten unas pocas consultas por hora y IP, que es
// bastante más de lo que manda alguien que realmente quiere escribirnos.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ventana de 1 hora
  handler: announce("el limitador del formulario de contacto", 60 * 60 * 1000),
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Ya enviaste varias consultas. Esperá un rato antes de mandar otra.' },
});

export { generalLimiter, authLimiter, lookupLimiter, contactLimiter };
