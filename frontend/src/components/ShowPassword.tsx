import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import '../styles/ShowPassword.css';

type ShowPasswordProps = {
  visible: boolean;
  onClick: () => void;
};

export function ShowPassword({ visible, onClick }: ShowPasswordProps) {

    return (
        <div className="show-password-wrapper" onClick={onClick}>
            <label className="show-password">Mostrar contraseña</label>
            <FontAwesomeIcon className="eye-icon" icon={visible ? faEye : faEyeSlash} />
        </div>
    );
}