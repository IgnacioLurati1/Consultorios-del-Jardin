import api from "../../axios";

/** Un paciente cuya asistencia quedó por debajo del umbral. No tiene penalización. */
export interface FlaggedPatient {
  email: string;
  name: string;
  surname: string;
  assisted: number;
  missed: number;
  /** Turnos cerrados: los que se sabe si vino o no. */
  closed: number;
  /** Proporción de asistencia sobre los cerrados, de 0 a 1. */
  rate: number;
}

/** Una cuenta que el sistema deshabilitó solo. */
export interface BannedPatient {
  email: string;
  name: string;
  surname: string;
  bannedAt: string | null;
  reason: string | null;
}

export interface BehaviourReport {
  banned: BannedPatient[];
  suspicious: FlaggedPatient[];
  /** Pacientes con al menos un turno cerrado: el universo sobre el que se mide. */
  measured: number;
  rules: {
    burstLimit: number;
    burstSeconds: number;
    dailyLimit: number;
    minMissed: number;
    ratePercent: number;
  };
}

export function findBehaviourReport(): Promise<BehaviourReport> {
  return api
    .get("/security/behaviour")
    .then((response) => response.data.data)
    .catch((err: any) => {
      throw new Error(err.response?.data?.message || err.message);
    });
}

/**
 * Cómo se explica una marca amarilla, en una línea.
 *
 * El texto dice las dos causas posibles a propósito. La cifra sale de los turnos
 * cerrados, y un turno se cierra cuando alguien marca si la persona vino: un profesional
 * que no está cargando las asistencias produce exactamente el mismo número que un
 * paciente que reserva y no aparece. Presentarlo como si solo pudiera ser lo segundo
 * sería acusar a alguien con un dato que no alcanza.
 */
export function explainSuspicion(patient: FlaggedPatient): string {
  const percent = Math.round(patient.rate * 100);

  return (
    `Asistió al ${percent}% de sus turnos cerrados (${patient.assisted} de ${patient.closed}), con ${patient.missed} ausencias. ` +
    "Puede ser que reserve y no venga, o que su profesional no esté cargando las asistencias. " +
    "No tiene ninguna penalización. Está marcado para que lo mires."
  );
}
