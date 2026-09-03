import { createContext, useContext, useState, useEffect } from "react";
import type {ReactNode} from "react"
import { clearSession, renewSession } from "../axios";

interface AuthContextProps {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  /**
   * Todavía estamos averiguando si hay sesión. Dura lo que tarda una llamada, y solo
   * ocurre al abrir la aplicación con el token de acceso vencido. Las pantallas privadas
   * lo miran para no mandar al login a alguien que en un instante va a estar adentro.
   */
  restoring: boolean;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

function getValidToken(): string | null {
  const stored = localStorage.getItem("token");
  if (!stored) return null;
  try {
    const payload = JSON.parse(atob(stored.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
  } catch {
    localStorage.removeItem("token");
    return null;
  }
  return stored;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(getValidToken());

  // El token de acceso dura quince minutos; el de refresh, treinta días. Sin esto,
  // cerrar la pestaña y volver un rato después era encontrarse el login de nuevo, con la
  // sesión perfectamente viva del otro lado.
  const [restoring, setRestoring] = useState(() => !getValidToken() && !!localStorage.getItem("refreshToken"));

  useEffect(() => {
    if (!restoring) return;

    let cancelled = false;
    renewSession().then((renewed) => {
      if (cancelled) return;
      if (renewed) setToken(renewed);
      setRestoring(false);
    });

    return () => {
      cancelled = true;
    };
  }, [restoring]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    // Los dos tokens, no solo el de acceso: el de refresh sobrevive treinta días y con
    // él solo se puede volver a entrar sin contraseña.
    clearSession();
    setToken(null);
  };

  useEffect(() => {
    const handleStorage = () => setToken(getValidToken());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, restoring }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};