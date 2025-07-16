import { useState } from "react";
import { DataInput } from "./DataInput";
import { ShowPassword } from "./ShowPassword";
import { Link } from "react-router-dom";
import '../styles/DataInputPassword.css';

type PasswordInputProps = {
  label: string;
  showForgotPasswordLink?: boolean;
};

export function DataInputPassword({ label, showForgotPasswordLink }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const toggleVisibility = () => {
    setVisible((v) => !v);
  };

  return (
    <div className="password-input-container">
      <DataInput label={label} type={visible ? "text" : "password"} />

      <div className="password-options">
        {showForgotPasswordLink && (
          <Link to='/' className="forgot-password">
            ¿Olvidaste tu contraseña?
          </Link>
        )}
        <ShowPassword visible={visible} onClick={toggleVisibility} />
      </div>
    </div>
  );
}
