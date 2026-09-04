import { Request, Response } from "express";
import { sendError, badRequest } from "../shared/errors.js";
import { CalendarImportService, ImportOptions, PaymentChoice, StateChoice } from "./import.service.js";
import { CalendarExportService, ExportOptions } from "./export.service.js";

interface RequestWithUser extends Request {
  user?: any;
  file?: Express.Multer.File;
}

const importService = new CalendarImportService();
const exportService = new CalendarExportService();

const STATE_CHOICES: StateChoice[] = ["past-assisted", "all-accepted", "all-assisted"];
const PAYMENT_CHOICES: PaymentChoice[] = ["past-paid", "all-paid", "none", "unset"];

/**
 * Las opciones vienen como texto.
 *
 * El archivo viaja en un formulario, no en un JSON, así que del otro lado todo llega como
 * string: "true" es un texto y no un booleano. Se valida acá y no más adentro para que el
 * servicio reciba opciones que ya se sabe que existen.
 */
function optionsFrom(body: any): ImportOptions {
  const state = String(body.state ?? "past-assisted") as StateChoice;
  const payment = String(body.payment ?? "past-paid") as PaymentChoice;

  if (!STATE_CHOICES.includes(state)) throw badRequest("Elegí cómo quedan los turnos importados");
  if (!PAYMENT_CHOICES.includes(payment)) throw badRequest("Elegí cómo queda el cobro de los turnos importados");

  return {
    from: String(body.from ?? ""),
    to: String(body.to ?? ""),
    state,
    payment,
    keepTitle: String(body.keepTitle ?? "true") !== "false",
    outsideSchedule: String(body.outsideSchedule ?? "false") === "true",
  };
}

function fileFrom(req: RequestWithUser): Buffer {
  if (!req.file?.buffer?.length) throw badRequest("Subí el archivo que exportaste de Google Calendar");

  return req.file.buffer;
}

/**
 * Qué entraría, sin guardar nada.
 *
 * Existe porque una importación no se puede deshacer con un botón: son cientos de turnos
 * y desarmarlos después es peor que no haberlos traído. Ver la cuenta antes es lo que
 * convierte una decisión a ciegas en una decisión.
 */
async function previewImport(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional")
      return res.status(403).json({ message: "Los turnos se importan a la agenda de un profesional" });

    const plan = await importService.plan(req.user.email, fileFrom(req), optionsFrom(req.body));

    res.status(200).json({ message: "Esto es lo que entraría", data: plan });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function runImport(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional")
      return res.status(403).json({ message: "Los turnos se importan a la agenda de un profesional" });

    const result = await importService.run(req.user.email, fileFrom(req), optionsFrom(req.body));

    res.status(201).json({ message: `Se importaron ${result.created} turnos`, data: result });
  } catch (error: any) {
    sendError(res, error);
  }
}

/**
 * El archivo con la agenda del profesional, para abrir en otro calendario.
 *
 * Va como descarga y no como JSON: lo que sigue después de esto es arrastrar el archivo a
 * Google Calendar, así que tiene que llegar al disco con su nombre y su tipo puestos.
 *
 * La cantidad viaja aparte, en un encabezado, porque el cuerpo es el archivo y no hay
 * dónde meterla: sin eso, el que aprieta exportar no tiene forma de distinguir una agenda
 * de un archivo vacío hasta que lo abre.
 */
async function exportCalendar(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional")
      return res.status(403).json({ message: "La agenda que se exporta es la de un profesional" });

    const options: ExportOptions = {
      from: String(req.query.from ?? ""),
      to: String(req.query.to ?? ""),
      includeCancelled: String(req.query.includeCancelled ?? "false") === "true",
      withPatientName: String(req.query.withPatientName ?? "true") !== "false",
    };

    const { ics, appointments } = await exportService.build(req.user.email, options);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${exportService.fileName(options)}"`);
    res.setHeader("X-Appointments", String(appointments));

    res.status(200).send(ics);
  } catch (error: any) {
    sendError(res, error);
  }
}

export { previewImport, runImport, exportCalendar };
