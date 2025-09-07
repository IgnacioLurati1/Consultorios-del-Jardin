import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

export function LoginRegister() {
  const {token, logout} = useAuth();

  return (
    <div className="login-register">
      {token? 
      <Link to={"/"}>
      <button className = "login out button-right" onClick={logout}>Cerrar sesión</button>
      </Link>
      :
      <>
      <Link to={"/Login"}>
        <button className="login button-right">Iniciar Sesión</button>
      </Link>
      <Link to={"/Register"}>
        <button className="register button-right">Registrarse</button>
      </Link>
      </> 
      }
      
    </div>
  );
}