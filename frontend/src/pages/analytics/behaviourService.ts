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
  /**
   * Proporción de asistencia sobre los cerrados, de 0 a 1. Null cuando no tiene ningún
   * turno cerrado, que le pasa a quien está marcado solo por dar de baja tarde.
   */
  rate: number | null;
  /**
   * Turnos que dio de baja con menos de un día de anticipación.
   *
   * Opcional porque la página y el servidor se publican por separado. Contra un servidor
   * todavía sin este dato la marca se sigue mostrando, explicada solo por las ausencias.
   */
  lateCancels?: number;
  /**
   * Por cuál de las dos reglas quedó marcado. Lo dice el servidor y no se deduce de los
   * números: quien avisa tarde puede tener la asistencia impecable, y sin esto la
   * pantalla nombraría ese porcentaje como si fuera parte del motivo.
   *
   * Opcional por lo mismo que `lateCancels`. Sin el dato se cae a lo que se puede
   * deducir, que es lo que la pantalla hacía antes de que existieran dos motivos.
   */
  reasons?: ("missed" | "lateCancels")[];
}

/** Por qué está marcado, con la deducción de siempre para un servidor que no lo diga. */
function motivos(patient: FlaggedPatient): { falta: boolean; tarde: boolean } {
  if (patient.reasons) {
    return { falta: patient.reasons.includes("missed"), tarde: patient.reasons.includes("lateCancels") };
  }

  return { falta: patient.rate !== null && patient.missed > 0, tarde: !!patient.lateCancels };
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
    minLateCancels?: number;
    shortNoticeHours?: number;
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
 * Son dos motivos y se entra por cualquiera de los dos, así que el texto arma solo las
 * partes que aplican. Si entró por las dos cosas, se dicen las dos.
 *
 * Lo de las ausencias dice las dos causas posibles a propósito. La cifra sale de los
 * turnos cerrados, y un turno se cierra cuando alguien marca si la persona vino: un
 * profesional que no está cargando las asistencias produce exactamente el mismo número
 * que un paciente que reserva y no aparece. Presentarlo como si solo pudiera ser lo
 * segundo sería acusar a alguien con un dato que no alcanza.
 */
export function explainSuspicion(patient: FlaggedPatient): string {
  const partes: string[] = [];
  const { falta, tarde } = motivos(patient);

  if (falta && patient.rate !== null) {
    const percent = Math.round(patient.rate * 100);
    partes.push(
      `Asistió al ${percent}% de sus turnos cerrados (${patient.assisted} de ${patient.closed}), con ${patient.missed} ausencias. ` +
        "Puede ser que reserve y no venga, o que su profesional no esté cargando las asistencias."
    );
  }

  if (tarde && patient.lateCancels) {
    partes.push(
      `Dio de baja ${patient.lateCancels} ${patient.lateCancels === 1 ? "turno" : "turnos"} con menos de un día de aviso, ` +
        "que es tiempo que no alcanza para ofrecerle ese horario a otra persona."
    );
  }

  partes.push("No tiene ninguna penalización. Está marcado para que lo mires.");
  return partes.join(" ");
}

/** El motivo de la marca, en pocas palabras, para la línea de la lista. */
export function summarizeSuspicion(patient: FlaggedPatient): string {
  const { falta, tarde } = motivos(patient);

  if (falta && tarde) return `Asistió al ${Math.round((patient.rate ?? 0) * 100)}% y avisa tarde`;
  // La cantidad va en la línea de abajo, así que acá se dice qué pasa y no cuántas veces.
  if (tarde) return "Da de baja sobre la hora";
  return `Asistió al ${Math.round((patient.rate ?? 0) * 100)}% de sus turnos`;
}

/** Las cifras del motivo por el que está marcado, y solo esas. */
export function countsOf(patient: FlaggedPatient): string {
  const { falta, tarde } = motivos(patient);
  const partes: string[] = [];

  if (falta) partes.push(`${patient.assisted} vinieron · ${patient.missed} no`);
  if (tarde) partes.push(`${patient.lateCancels} bajas sobre la hora`);

  return partes.join(" · ");
}
