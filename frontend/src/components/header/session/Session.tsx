import {useState } from "react";
import {LoginRegister} from "./LoginRegister";
import {Profile} from "./Profile";
import '../Header.css';

export function Session() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    //const accion = isLoggedIn ? "Cerrar Sesión" : "Iniciar Sesión";
    //<button onClick={() => {setIsLoggedIn(!isLoggedIn)}}> {accion} </button>
    return (

        <div className="session">
            {isLoggedIn ? 
            <Profile/> :
            <LoginRegister/>}
        </div>
    );
}

