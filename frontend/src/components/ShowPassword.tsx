import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import '../styles/ShowPassword.css';

export function ShowPassword(){

    const [visible, setVisible] = useState(false);

    return (
        <div className="show-password-wrapper" onClick={() => setVisible((v) => !v)}>
                            <label className="show-password">Mostrar contraseña</label>
                            <FontAwesomeIcon className="eye-icon" icon={visible ? faEyeSlash : faEye} />
        </div>
    );
}