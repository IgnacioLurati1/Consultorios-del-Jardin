import {LoginRegister} from "./LoginRegister";
import {Profile} from "./Profile";
import '../Header.css';
import { useAuth } from "../../../context/AuthContext";

export function Session() {
    const {token} = useAuth();
    //const accion = isLoggedIn ? "Cerrar Sesión" : "Iniciar Sesión";
    //<button onClick={() => {setIsLoggedIn(!isLoggedIn)}}> {accion} </button>
    return (
        <div className="session">
            {
            token ? 
            <Profile/> :
            <></>
            }
            <LoginRegister/>
            
        </div>
    );
}

