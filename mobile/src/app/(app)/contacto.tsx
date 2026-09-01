import { ContactForm } from "../../features/ContactForm";
import { useUser } from "../../session/SessionProvider";

/** El mismo formulario, con el email ya puesto: la sesión lo sabe. */
export default function ContactScreen() {
  const { email } = useUser();
  return <ContactForm defaultEmail={email} />;
}
