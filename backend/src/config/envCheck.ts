import dotenv from "dotenv";

dotenv.config();

import { isKnownTimezone } from "../shared/timezone.js";

/**
 * Lo que tiene que estar cargado para que el servidor arranque.
 *
 * `NODE_ENV` era un solo interruptor sin red: olvidarlo en un deploy levantaba el servidor
 * sincronizando el esquema (que sabe borrar columnas), con la documentación abierta, con
 * las consultas y los datos de los pacientes en el log de la plataforma, con los
 * limitadores multiplicados por veinte y con la cookie de sesión sin `secure`. Nada de eso
 * avisaba: la aplicación funcionaba.
 *
 * Con varias instalaciones del mismo código esto deja de ser un descuido posible y pasa a
 * ser uno probable, así que ahora el arranque se niega. Es preferible un deploy que no
 * levanta y lo dice a uno que levanta mal y no lo dice.
 *
 * Acá nunca se imprime el valor de una variable, solo su nombre.
 */

/** Hacen falta siempre, en cualquier modo. */
const SIEMPRE = ["JWT_SECRET", "REFRESH_SECRET", "CHANGE_SECRET"];

/** Hacen falta además cuando esto es una instalación de verdad. */
const EN_PRODUCCION = [
  "TOKEN_ISSUER",
  "CONSOLE_JWT_SECRET",
  "BASE_URL",
  "WEB_ORIGIN",
  "CONSOLE_ORIGIN",
  "OWNER_EMAILS",
  "MAIL",
  "MAIL_SENDER_NAME",
  "BREVO_KEY",
  "INITIAL_ADMINS",
];

/**
 * Largo mínimo de una clave de firma.
 *
 * No es una medida de entropía, es un filtro contra el valor de ejemplo. Una clave de
 * cuatro letras copiada del archivo de muestra pasa cualquier chequeo de presencia.
 */
const LARGO_MINIMO = 32;

const CLAVES = ["JWT_SECRET", "REFRESH_SECRET", "CHANGE_SECRET", "CONSOLE_JWT_SECRET"];

/** Valores que vienen del archivo de ejemplo y nunca son una clave real. */
const DE_EJEMPLO = [/^cambiame/i, /^changeme/i, /^secret$/i, /^tu[-_]?clave/i, /^xxx+$/i];

function faltantes(nombres: string[]): string[] {
  return nombres.filter((nombre) => !String(process.env[nombre] ?? "").trim());
}

export function checkEnv(): void {
  const esProduccion = process.env.NODE_ENV === "production";
  const problemas: string[] = [];

  const sinCargar = faltantes(esProduccion ? [...SIEMPRE, ...EN_PRODUCCION] : SIEMPRE);
  if (sinCargar.length) {
    problemas.push(`Faltan variables: ${sinCargar.join(", ")}`);
  }

  for (const nombre of CLAVES) {
    const valor = String(process.env[nombre] ?? "").trim();
    if (!valor) continue; // ya lo dijo el bloque de arriba, si hacía falta

    if (valor.length < LARGO_MINIMO) {
      problemas.push(`${nombre} es demasiado corta (${LARGO_MINIMO} caracteres como mínimo)`);
    }
    if (DE_EJEMPLO.some((patron) => patron.test(valor))) {
      problemas.push(`${nombre} todavía tiene el valor del archivo de ejemplo`);
    }
  }

  // Dos claves iguales no son dos claves. Importa sobre todo entre la de la aplicación y
  // la de la consola: con el mismo valor, una sesión normal abre la consola.
  const cargadas = CLAVES.map((nombre) => [nombre, String(process.env[nombre] ?? "").trim()] as const).filter(
    ([, valor]) => valor
  );
  for (let i = 0; i < cargadas.length; i++) {
    for (let j = i + 1; j < cargadas.length; j++) {
      if (cargadas[i][1] === cargadas[j][1]) {
        problemas.push(`${cargadas[i][0]} y ${cargadas[j][0]} tienen el mismo valor`);
      }
    }
  }

  // Una zona mal escrita no la rechaza nadie más adelante: el servidor arrancaría con la
  // hora de otro lado y los recordatorios saldrían corridos.
  const zona = String(process.env.TIMEZONE ?? "").trim();
  if (zona && !isKnownTimezone(zona)) problemas.push("TIMEZONE no es una zona horaria conocida");

  if (esProduccion) {
    // Sin esto, los links de los mails salen con "undefined" adelante.
    const base = String(process.env.BASE_URL ?? "").trim();
    if (base && !/^https:\/\//i.test(base)) {
      problemas.push("BASE_URL tiene que empezar con https://");
    }
    const consola = String(process.env.CONSOLE_ORIGIN ?? "").trim();
    if (consola && !/^https:\/\//i.test(consola)) {
      problemas.push("CONSOLE_ORIGIN tiene que empezar con https://");
    }
  }

  if (!problemas.length) return;

  const detalle = problemas.map((problema) => `  · ${problema}`).join("\n");
  throw new Error(
    `El servidor no arranca porque la configuración está incompleta.\n${detalle}\n` +
      "Ninguno de estos valores se imprime acá. Revisá las variables del deploy."
  );
}
