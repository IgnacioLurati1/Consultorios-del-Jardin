import '../styles/index.css';
import { Link } from 'react-router-dom';

export function LoginRegister() {

  return (
    <div className="login-register">
      <button className="login button-right">Iniciar Sesión</button>
          <Link to={"/Register"}>
            <button className="register button-right">Registrarse</button>
          </Link>
    </div>
  );
}