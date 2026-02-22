import ReCAPTCHA from "react-google-recaptcha";

interface ReCaptchaProps {
  onChange: (ok: boolean) => void;
}

const ReCaptcha = ({ onChange }: ReCaptchaProps) => {

  const handleChange = (token: string | null) => {
    onChange(!!token);
  };

  return (
    <ReCAPTCHA
      sitekey="6LejEzAsAAAAABuietwrFo1G1vZSsh_Ht2ZEvwCf"
      onChange={handleChange}
    />
  );
};

export default ReCaptcha;