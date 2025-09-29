import { createContext, useContext, useState, useEffect } from "react";
import type {ReactNode} from "react"
import type { TokenPayload } from "../pages/types";
import { jwtDecode } from "jwt-decode";

interface AuthContextProps {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  //valido apenas inicia el programa si el token está vencido
  useEffect(()=>{
    if(token){
      try{
        const decoded: TokenPayload = jwtDecode(token)
        if(decoded.exp* 1000 < Date.now()){ //Tomo la fecha de exp del token y la multiplico *1000 ya que el date.now esta en milisegundos
          logout(); // Token vencido
        }
      }
      catch{
        logout(); //token invalido
      }
    }
  })


  useEffect(() => {
    const handleStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};