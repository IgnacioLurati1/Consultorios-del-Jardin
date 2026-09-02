import api from "./client";

/** Un paciente cuya asistencia quedó por debajo del umbral. No tiene penalización. */
export interface FlaggedPatient {
  email: string;
  name: string;
  surname: string;
  assisted: number;
  missed: number;
  closed: number;
  /** Proporción de asistencia sobre los turnos cerrados, de 0 a 1. */
  rate: number;
}

export interface BehaviourReport {
  banned: { email: string; name: string; surname: string; bannedAt: string | null; reason: string | null }[];
  suspicious: FlaggedPatient[];
  measured: number;
  rules: { burstLimit: number; burstSeconds: number; dailyLimit: number; minMissed: number; ratePercent: number };
}

/** Solo para el admin. */
export function behaviourReport(): Promise<BehaviourReport> {
  return api.get("/security/behaviour").then((response) => response.data.data);
}

/**
 * Cómo se explica una marca amarilla.
 *
 * Dice las dos causas posibles a propósito: la misma cifra la produce un paciente que
 * reserva y no viene, y un profesional que no está cargando las asistencias.
 */
export function explainSuspicion(patient: FlaggedPatient): string {
  return (
    `Asistió al ${Math.round(patient.rate * 100)}% de sus turnos cerrados, con ${patient.missed} ausencias. ` +
    "Puede ser que reserve y no venga, o que su profesional no esté cargando las asistencias. Es solo una marca."
  );
}
