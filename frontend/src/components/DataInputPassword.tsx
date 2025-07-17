import { useState } from "react";
import { DataInput } from "./DataInput";
import { ShowPassword } from "./ShowPassword";
import { Link } from "react-router-dom";
import '../styles/DataInputPassword.css';

type PasswordInputProps = {
  label: string;
  value:string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  showForgotPasswordLink?: boolean;
};

export function DataInputPassword({ label, showForgotPasswordLink, value, onChange }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const toggleVisibility = () => {
    setVisible((v) => !v);
  };

  return (
    <div className="password-input-container">
      <DataInput label={label} type={visible ? "text" : "password"} value={value} onChange={onChange} />

      <div className="password-options">
        {showForgotPasswordLink && (
          <Link to='/forgot-password' className="forgot-password">
            ¿Olvidaste tu contraseña?
          </Link>
        )}
        <ShowPassword visible={visible} onClick={toggleVisibility} />
      </div>
    </div>
  );
}
