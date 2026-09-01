import rateLimit from "express-rate-limit";

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 500,                  
  standardHeaders: true,     
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá más tarde.' },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // ventana de 10 minutos
  max: 10,
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
  max: 60,
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
