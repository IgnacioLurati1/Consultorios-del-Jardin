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

export { generalLimiter, authLimiter };
