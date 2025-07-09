import '../styles/index.css';
import { Link } from 'react-router-dom';

export function LoginRegister() {

  return (
    <div className="login-register">
      <Link to={"/Login"}>
        <button className="login button-right">Iniciar Sesión</button>
      </Link>
      <Link to={"/Register"}>
        <button className="register button-right">Registrarse</button>
      </Link>
    </div>
  );
}