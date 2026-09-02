import api from "../../axios";

/** Un toque a un endpoint delicado, tal como quedó registrado. */
export interface TrailStep {
  at: string;
  /** Cómo se llama lo que se hizo, en castellano. */
  label: string;
  method: string;
  path: string;
  /** Con qué respondió el servidor. Un 403 es un intento que no llegó a ninguna parte. */
  status: number | null;
}

/** Una cuenta que el sistema cerró por parecer estar en manos de otro. */
export interface CompromisedAccount {
  email: string;
  name: string;
  surname: string;
  type: string;
  /** Falso salvo el caso del último administrador, que se marca pero no se cierra. */
  active: boolean;
  bannedAt: string | null;
  reason: string | null;
  /** Lo que tocó en la hora previa, de lo más nuevo a lo más viejo. */
  trail: TrailStep[];
}

export interface IntrusionRules {
  burstSeconds: number;
  burst: Record<string, number>;
  burstFallback: number;
  night: Record<string, number>;
  nightFallback: number;
  nightFrom: number;
  nightTo: number;
}

export interface CompromisedReport {
  accounts: CompromisedAccount[];
  rules: IntrusionRules;
}

export function findCompromisedAccounts(): Promise<CompromisedReport> {
  return api
    .get("/security/compromised")
    .then((response) => response.data.data)
    .catch((err: any) => {
      throw new Error(err.response?.data?.message || err.message);
    });
}

/** Qué significa la marca, en una línea, para el hover del listado de usuarios. */
export function explainCompromise(reason: string | null, active: boolean): string {
  const what = reason ? reason.charAt(0).toLowerCase() + reason.slice(1) : "se comportó como si la manejara otra persona";

  return (
    `El sistema detectó que ${what}. ` +
    (active
      ? "No se cerró el acceso porque es la única cuenta de administración activa, pero hay que revisarla. "
      : "El acceso quedó cerrado y la persona recibió un mail avisándole. ") +
    "Antes de volver a habilitarla conviene mirar qué llegó a tocar, en Números del sistema."
  );
}
