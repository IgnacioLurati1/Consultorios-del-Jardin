import {
  acceptedMail,
  canceledMail,
  createdMail,
  factsFor,
  newBookingMail,
  reminderMail,
  type BuiltMail,
  type MailData,
} from "../appointments/appointmentMails.js";
import { DEFAULT_MAIL_IDENTITY, shell, type MailIdentity } from "../config/mailTemplate.js";
import { badRequest } from "../shared/errors.js";
import { parseVocabulary, words, type Words } from "../shared/vocabulary.js";
import { config } from "./installation.service.js";
import { elementColorsOf } from "../shared/elementColors.js";

/**
 * Un mail de muestra, armado con lo que se está editando y sin guardar nada.
 *
 * Es la vista previa de la configuración: se cambian las palabras del rubro, el nombre o
 * el color, y al lado aparece el mail tal como le llegaría a alguien. No es una imagen ni
 * una maqueta: son las mismas funciones que arman los mails de verdad (appointmentMails)
 * y el mismo sobre (mailTemplate), con un turno inventado adentro.
 *
 * No manda nada y no toca la base más que para leer la configuración guardada, que es lo
 * que se usa para lo que la pantalla no mandó.
 */

export const PREVIEW_KINDS = ["pedido", "confirmado", "recordatorio", "cancelado", "profesional"] as const;
export type PreviewKind = (typeof PREVIEW_KINDS)[number];

/** Un turno de muestra, con nombres que no son de nadie. */
function sampleData(w: Words, to: "patient" | "professional", base: string): MailData {
  return {
    facts: factsFor(w, to, {
      date: "martes 6 de octubre",
      start: "10:30",
      end: "11:15",
      professional: "Ana Pérez",
      patient: "Juan Gómez",
      room: `${w.Sala} 2`,
    }),
    when: "martes 6 de octubre a las 10:30",
    agenda: "martes 6 de octubre de 10:30 a 11:15",
    patient: "Juan Gómez",
    professional: "Ana Pérez",
    url: (path) => `${base}${path}`,
    shortNoticeHours: 24,
  };
}

/** El texto de lo que se va a mostrar, con el mismo criterio que los textos del panel. */
function text(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

export async function previewMail(kind: unknown, draft: Record<string, any> = {}): Promise<BuiltMail> {
  if (!(PREVIEW_KINDS as readonly string[]).includes(String(kind))) throw badRequest("Ese mail no tiene vista previa");

  const saved = await config().catch(() => null);

  // Las palabras: las que se están editando, o las guardadas.
  let vocabulary = saved?.vocabulary;
  if (draft.vocabulary !== undefined) {
    const parsed = parseVocabulary(draft.vocabulary);
    if ("problem" in parsed) throw badRequest(parsed.problem);
    vocabulary = parsed.vocabulary;
  }
  const w = words(vocabulary);

  // El sobre: lo que se está editando, o lo guardado, o lo de siempre.
  const hue = draft.brandHue !== undefined ? draft.brandHue : saved?.brandHue;
  const saturation = draft.brandSaturation !== undefined ? draft.brandSaturation : saved?.brandSaturation;
  const identity: MailIdentity = {
    name: text(draft.name, saved?.name ?? DEFAULT_MAIL_IDENTITY.name, 120) || DEFAULT_MAIL_IDENTITY.name,
    address: text(draft.address, saved?.address ?? DEFAULT_MAIL_IDENTITY.address, 160),
    publicHours: text(draft.publicHours, saved?.publicHours ?? DEFAULT_MAIL_IDENTITY.publicHours, 120),
    instagram: text(draft.instagram, saved?.instagram ?? DEFAULT_MAIL_IDENTITY.instagram, 80),
    phone: text(draft.phone, saved?.phone ?? "", 40),
    whatsapp: text(draft.whatsapp, saved?.whatsapp ?? "", 40),
    services: Array.isArray(draft.services)
      ? draft.services.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 20)
      : (saved?.services ?? DEFAULT_MAIL_IDENTITY.services),
    brand:
      typeof hue === "number" && typeof saturation === "number"
        ? { hue: Math.max(0, Math.min(360, hue)), saturation: Math.max(0, Math.min(100, saturation)) }
        : null,
    // El color propio de la cabecera: el que se está editando, o el guardado.
    headerColor:
      draft.elementColors !== undefined
        ? (elementColorsOf(JSON.stringify(draft.elementColors ?? {})).mail ?? null)
        : (saved?.elementColors?.mail ?? null),
  };

  const advice = text(draft.visitAdvice, saved?.visitAdvice ?? "", 160);
  const base = process.env.BASE_URL ?? "";

  const mail: BuiltMail = (() => {
    switch (kind as PreviewKind) {
      case "pedido":
        return createdMail(w, sampleData(w, "patient", base));
      case "confirmado":
        return acceptedMail(w, sampleData(w, "patient", base), advice);
      case "recordatorio":
        return reminderMail(w, sampleData(w, "patient", base), {
          day: "tomorrow",
          address: identity.address,
          advice,
          links: { yes: `${base}/asistencia`, no: `${base}/asistencia` },
        });
      case "cancelado":
        return canceledMail(w, sampleData(w, "patient", base));
      case "profesional":
        return newBookingMail(w, sampleData(w, "professional", base), true);
    }
  })();

  return {
    subject: mail.subject,
    html: shell(mail.html, { baseUrl: base, mail: process.env.MAIL ?? "", identity }),
  };
}
