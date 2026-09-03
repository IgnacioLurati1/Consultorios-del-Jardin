import { useEffect, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface AuthWatcherProps {
  children: ReactNode;
}

export function AuthWatcher({children}:AuthWatcherProps) {
  const { token, restoring } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Mientras se recupera la sesión no hay token todavía, y eso no quiere decir que no
    // haya sesión: quiere decir que falta un instante para saberlo.
    if (!token && !restoring) {
      navigate("/login");
    }
  }, [token, restoring, navigate]);

  return <>{children}</>; 
}