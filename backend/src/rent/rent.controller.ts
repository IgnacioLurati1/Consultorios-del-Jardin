import { Request, Response } from "express";
import { RentService } from "./rent.service.js";
import { sendError } from "../shared/errors.js";

const rent = new RentService();

/**
 * Todas contestan `{ data }` y pasan el error por `sendError`.
 *
 * Los cambios sobre una cuota devuelven el mes entero y no solo la fila: cambiar una cuota
 * mueve los totales de arriba, y así la pantalla no tiene que rehacer la cuenta ni pedir
 * dos veces.
 */
function handle(action: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      res.status(200).json({ data: await action(req) });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export const getMonth = handle((req) => rent.month(req.params.month));

export const putAmount = handle(async (req) => {
  await rent.setAmount(req.params.email, req.params.month, req.body?.amount);
  return rent.month(req.params.month);
});

export const putPayment = handle(async (req) => {
  await rent.setPayment(req.params.email, req.params.month, req.body ?? {});
  return rent.month(req.params.month);
});

export const getPrices = handle((req) => rent.roomPrices(req.query.month));
export const putPrices = handle((req) => rent.setRoomPrices(req.body ?? {}));
export const putSettings = handle((req) => rent.setDueDay(req.body?.dueDay));

export const getCalculation = handle((req) => rent.calculationPreview(req.query.from));
export const postCalculation = handle((req) => rent.applyCalculation(req.body ?? {}));
export const postIncrease = handle((req) => rent.applyIncrease(req.body ?? {}));

export const getFreeBlocks = handle((req) => rent.freeBlocksReport(req.query.month));
export const getIncreaseSimulation = handle((req) => rent.increaseSimulation(req.query));

/** La planilla del mes, con el histórico en otra hoja. */
export async function exportMonth(req: Request, res: Response) {
  try {
    const { filename, buffer } = await rent.exportMonth(req.params.month);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
}
