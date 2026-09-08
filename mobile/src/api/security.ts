import api from "./client";

/** Un paciente que falta seguido o que da de baja sobre la hora. No tiene penalización. */
export interface FlaggedPatient {
  email: string;
  name: string;
  surname: string;
  assisted: number;
  missed: number;
  closed: number;
  /**
   * Proporción de asistencia sobre los turnos cerrados, de 0 a 1. Null cuando no tiene
   * ningún turno cerrado, que le pasa a quien está marcado solo por avisar tarde.
   */
  rate: number | null;
  /**
   * Turnos que dio de baja con menos de un día de anticipación.
   *
   * Opcional porque la aplicación y el servidor se publican por separado, y una versión
   * instalada vive en el teléfono todo lo que la persona quiera. Contra un servidor
   * todavía sin este dato la marca se muestra igual, explicada solo por las ausencias.
   */
  lateCancels?: number;
  /**
   * Por cuál de las dos reglas quedó marcado. Lo dice el servidor y no se deduce de los
   * números: quien avisa tarde puede tener la asistencia impecable, y sin esto la
   * pantalla nombraría ese porcentaje como si fuera parte del motivo.
   *
   * Opcional por lo mismo que `lateCancels`. Sin el dato se cae a lo que se puede
   * deducir, que es lo que la pantalla hacía cuando el motivo era uno solo.
   */
  reasons?: ("missed" | "lateCancels")[];
}

export interface BehaviourReport {
  banned: { email: string; name: string; surname: string; bannedAt: string | null; reason: string | null }[];
  suspicious: FlaggedPatient[];
  measured: number;
  rules: {
    burstLimit: number;
    burstSeconds: number;
    dailyLimit: number;
    minMissed: number;
    ratePercent: number;
    minLateCancels?: number;
    shortNoticeHours?: number;
  };
}

/** Solo para el admin. */
export function behaviourReport(): Promise<BehaviourReport> {
  return api.get("/security/behaviour").then((response) => response.data.data);
}

/**
 * Cómo se explica una marca amarilla.
 *
 * Son dos motivos y se entra por cualquiera de los dos, así que se arman solo las partes
 * que aplican. Lo de las ausencias dice las dos causas posibles a propósito: la misma
 * cifra la produce un paciente que reserva y no viene, y un profesional que no está
 * cargando las asistencias.
 */
export function explainSuspicion(patient: FlaggedPatient): string {
  const partes: string[] = [];

  const falta = patient.reasons ? patient.reasons.includes("missed") : patient.rate !== null && patient.missed > 0;
  const tarde = patient.reasons ? patient.reasons.includes("lateCancels") : !!patient.lateCancels;

  if (falta && patient.rate !== null) {
    partes.push(
      `Asistió al ${Math.round(patient.rate * 100)}% de sus turnos cerrados, con ${patient.missed} ausencias. ` +
        "Puede ser que reserve y no venga, o que su profesional no esté cargando las asistencias."
    );
  }

  if (tarde && patient.lateCancels) {
    partes.push(
      `Dio de baja ${patient.lateCancels} ${patient.lateCancels === 1 ? "turno" : "turnos"} con menos de un día de aviso.`
    );
  }

  partes.push("Es solo una marca.");
  return partes.join(" ");
}
