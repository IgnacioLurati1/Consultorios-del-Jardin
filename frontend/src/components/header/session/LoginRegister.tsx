import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import api from "../../../axios";

export function LoginRegister() {
  const {token, logout} = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    api.post('/people/logout', {}, { withCredentials: true })
  }

  return (
    <div className="login-register">
      {token? 
      <button className = "login out button-right" onClick={handleLogout}>Cerrar sesión</button>
      :
      <>
      <Link to={"/login"}>
        <button className="login button-right">Iniciar Sesión</button>
      </Link>
      <Link to={"/register"}>
        <button className="register button-right">Registrarse</button>
      </Link>
      </> 
      }
      
    </div>
  );
}