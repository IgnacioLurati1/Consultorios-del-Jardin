import { Request, Response } from "express";
import { ConsoleService } from "./console.service.js";
import { sendError } from "../shared/errors.js";
import { auditConsole, ownerEmails } from "./console.guard.js";
import { tokenIssuer } from "../config/tokens.js";
import { rulesView, updateConfig } from "../installation/installation.service.js";
import { POLICY_PRESETS, policyDef } from "../shared/policies.js";

interface RequestWithOwner extends Request {
  owner?: { email: string };
}

const consoleService = new ConsoleService();

async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body ?? {};
    const session = await consoleService.login(email, password);
    auditConsole(req, "entró", session.email);
    res.status(200).json(session);
  } catch (error: any) {
    auditConsole(req, "no entró", String(req.body?.email ?? "").trim().toLowerCase() || undefined);
    sendError(res, error);
  }
}

/** Qué instalación es esta. Lo primero que muestra la consola, para no operar a ciegas. */
async function status(req: RequestWithOwner, res: Response) {
  try {
    const admins = await consoleService.listAdmins();
    res.status(200).json({
      issuer: tokenIssuer(),
      claimsRequired: process.env.TOKEN_STRICT === "1",
      owners: ownerEmails().length,
      admins,
    });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function createAdmin(req: RequestWithOwner, res: Response) {
  try {
    const { password, email, name, surname } = req.body ?? {};
    const result = await consoleService.createAdmin(req.owner!.email, password, { email, name, surname });

    auditConsole(req, `creó al administrador ${result.email}`);

    res.status(201).json({
      message: result.mailSent
        ? "Administrador creado. Le llegó el mail para elegir su contraseña"
        : "Administrador creado. El mail no salió, hay que reenviarlo desde el panel",
      ...result,
    });
  } catch (error: any) {
    auditConsole(req, `no pudo crear un administrador (${error?.message ?? "error"})`);
    sendError(res, error, { duplicate: "Ya hay una cuenta con ese correo" });
  }
}

/** Todas las reglas, las del dueño incluidas, con los puntos de partida. */
async function getRules(_req: RequestWithOwner, res: Response) {
  try {
    res.status(200).json({ ...(await rulesView("owner")), presets: POLICY_PRESETS });
  } catch (error: any) {
    sendError(res, error);
  }
}

/**
 * Cambia reglas y bloqueos.
 *
 * Llega `{ values, locked }`: los valores, de columna o del JSON, mezclados como los
 * muestra la consola; y la lista entera de bloqueadas, si cambió.
 */
async function patchRules(req: RequestWithOwner, res: Response) {
  try {
    const { values = {}, locked } = req.body ?? {};
    const view = await rulesView("owner");
    const columns: Record<string, unknown> = {};
    const policies: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      const rule = view.rules.find((item) => item.key === key);
      if (!rule) return res.status(400).json({ message: `No existe la regla "${key}"` });
      if (key in view.values && JSON.stringify(view.values[key]) === JSON.stringify(value)) continue;
      if (policyDef(key)?.stored === "column") columns[key] = value;
      else policies[key] = value;
    }

    await updateConfig(
      { ...columns, ...(Object.keys(policies).length ? { policies } : {}), ...(locked !== undefined ? { locked } : {}) },
      "owner"
    );
    auditConsole(req, `cambió reglas (${[...Object.keys(columns), ...Object.keys(policies)].join(", ") || "solo bloqueos"})`);
    res.status(200).json({ message: "Reglas guardadas", ...(await rulesView("owner")), presets: POLICY_PRESETS });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { login, status, createAdmin, getRules, patchRules };
