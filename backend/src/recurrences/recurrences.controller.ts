import { Request, Response, NextFunction } from "express";
import { RecurrenceService } from "./recurrences.service.js";
import { sendError } from "../shared/errors.js";
import { cachedWords, officeWords } from "../installation/installation.service.js";

interface RequestWithUser extends Request {
  user?: any;
}

const recurrenceService = new RecurrenceService();

/** Los turnos repetibles son cosa del profesional: nadie más los crea ni los frena. */
function onlyProfessional(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.user.type !== "professional")
    return res.status(403).json({ message: `Esta acción es solo para ${cachedWords().profesionales}` });
  next();
}

async function getRecurrences(req: RequestWithUser, res: Response) {
  try {
    const recurrences = await recurrenceService.findForProfessional(req.user.email);
    res.status(200).json({ data: recurrences });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function createRecurrence(req: RequestWithUser, res: Response) {
  try {
    const numAppointment = Number.parseInt(req.body.numAppointment);
    if (Number.isNaN(numAppointment))
      return res.status(400).json({ message: `Falta ${(await officeWords()).el("turno")} que se quiere repetir` });

    const result = await recurrenceService.createFromAppointment(
      numAppointment,
      req.user.email,
      req.body.frequency,
      req.body.endDate
    );

    const w = await officeWords();
    res.status(201).json({
      message: `${w.Turno} repetible cread${w.o("turno")}`,
      data: { idRecurrence: result.recurrence.idRecurrence, created: result.created, skipped: result.skipped },
    });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function updateRecurrence(req: RequestWithUser, res: Response) {
  try {
    const idRecurrence = Number.parseInt(req.params.idRecurrence);
    const { frequency, value, idRoom, patientEmail, endDate } = req.body;

    const recurrence = await recurrenceService.update(idRecurrence, req.user.email, {
      frequency,
      value: value === undefined ? undefined : Number(value),
      idRoom: idRoom === undefined ? undefined : Number(idRoom),
      patientEmail,
      endDate,
    });

    res.status(200).json({ message: "Repetición actualizada", data: { idRecurrence: recurrence.idRecurrence } });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function stopRecurrence(req: RequestWithUser, res: Response) {
  try {
    const idRecurrence = Number.parseInt(req.params.idRecurrence);
    await recurrenceService.stop(idRecurrence, req.user.email);

    const w = await officeWords();
    res.status(200).json({ message: `Se frenó la repetición. ${w.Los("turno")} ya cread${w.os("turno")} siguen en pie.` });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { onlyProfessional, getRecurrences, createRecurrence, updateRecurrence, stopRecurrence };
