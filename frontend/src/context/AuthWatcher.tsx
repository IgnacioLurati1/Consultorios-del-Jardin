import { useEffect, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface AuthWatcherProps {
  children: ReactNode;
}

export function AuthWatcher({children}:AuthWatcherProps) {
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  return <>{children}</>; 
}