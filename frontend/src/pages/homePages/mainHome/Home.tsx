import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { findPerson, getDecodedToken } from "../../commonServices";
import { Hero } from "./HomeComponents/Hero";
import { Specialities } from "./HomeComponents/Specialities";
import { YourSpace } from "./HomeComponents/YourSpace";
import { Footer } from "./HomeComponents/Footer";
import "./Home.css";

/** Quién está mirando la página: define qué se le ofrece hacer. */
export interface Session {
  type: "guest" | "client" | "professional" | "admin";
  /** Nombre de pila, para saludar. Puede tardar en llegar o no llegar nunca. */
  firstName?: string;
}

/**
 * La portada tiene dos trabajos y los dos son de la misma pantalla: contar qué es el
 * consultorio para quien llega de afuera, y ser el atajo más corto a lo suyo para quien
 * ya tiene cuenta. Por eso todo lo que es una acción sale de `session`.
 */
function useSession(): Session {
  const { token } = useAuth();
  const [firstName, setFirstName] = useState<string | undefined>(undefined);

  const decoded = token ? getDecodedToken() : null;
  const type = (decoded?.type ?? "guest") as Session["type"];

  useEffect(() => {
    if (!decoded) {
      setFirstName(undefined);
      return;
    }

    // Si el pedido falla la página funciona igual: el saludo es lo único que se pierde.
    findPerson(decoded.email)
      .then((person) => setFirstName(person?.name))
      .catch(() => setFirstName(undefined));
  }, [token]);

  return { type, firstName };
}

export function Home() {
  const session = useSession();

  // Quien ya tiene cuenta viene a hacer algo: sus accesos van antes que la
  // presentación del consultorio. Quien llega de afuera necesita el orden inverso.
  const guest = session.type === "guest";

  return (
    <div className="home">
      <Hero session={session} />
      {guest ? (
        <>
          <Specialities session={session} />
          <YourSpace session={session} />
        </>
      ) : (
        <>
          <YourSpace session={session} />
          <Specialities session={session} />
        </>
      )}
      <Footer />
    </div>
  );
}
