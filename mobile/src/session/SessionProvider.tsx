import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { setSessionLostHandler } from "../api/client";
import { login as loginRequest, signUp as signUpRequest, SignUpInput } from "../api/people";
import { clearTokens, currentUser, loadTokens, Role, saveTokens } from "../api/tokens";
import { clearAlerts } from "../lib/alerts";

export interface Session {
  email: string;
  role: Role;
}

interface SessionValue {
  session: Session | null;
  /** Mientras se lee el llavero no se sabe todavía si hay sesión: la app espera. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const readSession = useCallback(() => {
    const user = currentUser();
    setSession(user ? { email: user.email, role: user.type } : null);
  }, []);

  const signOut = useCallback(async () => {
    // El logout de verdad es local: el refresh token sigue siendo válido hasta que
    // vence, pero deja de existir en este teléfono. Se le avisa al backend igual, que es
    // el que borra la cookie cuando el que cierra sesión es el navegador.
    try {
      await api.post("/people/logout");
    } catch {
      // Cerrar sesión no puede depender de que haya señal.
    }

    // Los avisos de turno son de la agenda de quien estaba adentro: si quedaran
    // programados, al teléfono le seguiría sonando el turno de otro.
    await clearAlerts().catch(() => {});

    await clearTokens();
    setSession(null);
  }, []);

  useEffect(() => {
    let alive = true;

    loadTokens()
      .then(() => {
        if (alive) readSession();
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [readSession]);

  // Cuando el refresh token también vence o la cuenta queda deshabilitada, el cliente
  // HTTP avisa por acá y la app entera vuelve al login.
  useEffect(() => {
    setSessionLostHandler(() => setSession(null));
    return () => setSessionLostHandler(() => {});
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, refreshToken } = await loginRequest(email, password);
      await saveTokens(token, refreshToken);
      readSession();
    },
    [readSession]
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const { token, refreshToken } = await signUpRequest(input);
      await saveTokens(token, refreshToken);
      readSession();
    },
    [readSession]
  );

  const value = useMemo<SessionValue>(
    () => ({ session, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession se usa adentro de SessionProvider");
  return value;
}

/** La sesión cuando ya se sabe que existe: adentro del grupo (app) siempre hay una. */
export function useUser(): Session {
  const { session } = useSession();
  if (!session) throw new Error("No hay sesión en esta pantalla");
  return session;
}
