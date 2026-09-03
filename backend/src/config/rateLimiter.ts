import rateLimit from "express-rate-limit";

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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 500 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá más tarde.' },
});

// Diez intentos por minuto y por IP. La ventana corta es deliberada: frena de igual
// forma a quien prueba contraseñas —que necesita miles, no diez— pero a alguien que se
// equivocó de tecla lo deja reintentando en menos de lo que tarda en releer el mail,
// en vez de dejarlo afuera diez minutos. La misma ventana cubre renovar la sesión, que
// desde una red compartida son varias personas sumando contra la misma IP.
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // ventana de 1 minuto
  max: 10 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá más tarde.' },
});

// Consultas de solo lectura sin sesión (¿este email ya tiene cuenta?). Es más
// permisivo que authLimiter porque el registro lo llama mientras se escribe, pero
// sigue estando acotado: si no, sería una forma cómoda de averiguar qué emails
// están registrados.
const lookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60 * RELAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas, intentá más tarde.' },
});

// Formulario de contacto. Cada envío dispara mails de verdad, así que es la ruta
// pública más cara de abusar: se permiten unas pocas consultas por hora y IP, que es
// bastante más de lo que manda alguien que realmente quiere escribirnos.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ventana de 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Ya enviaste varias consultas. Esperá un rato antes de mandar otra.' },
});

export { generalLimiter, authLimiter, lookupLimiter, contactLimiter };
