import { useAuth } from "../../../context/AuthContext";
import { getDecodedToken } from "../../commonServices";
import { Hero } from "./HomeComponents/Hero";
import { Specialities } from "./HomeComponents/Specialities";
import { Gallery } from "./HomeComponents/Gallery";
import { YourSpace } from "./HomeComponents/YourSpace";
import { Footer } from "./HomeComponents/Footer";
import { Location } from "./HomeComponents/Location";
import "./Home.css";

/** Quién está mirando la página: define qué se le ofrece hacer. */
export interface Session {
  type: "guest" | "client" | "professional" | "admin";
}

/**
 * La portada tiene dos trabajos y los dos son de la misma pantalla: mostrar el
 * consultorio a quien llega de afuera, y ser el atajo más corto a lo suyo para quien ya
 * tiene cuenta. Por eso todo lo que es una acción sale de `session`.
 */
function useSession(): Session {
  // El token se lee del contexto aunque después se decodifique aparte: es lo que hace que
  // la portada se vuelva a dibujar al iniciar o cerrar sesión.
  const { token } = useAuth();
  const decoded = token ? getDecodedToken() : null;

  return { type: (decoded?.type ?? "guest") as Session["type"] };
}

export function Home() {
  const session = useSession();

  // Quien ya tiene cuenta viene a hacer algo: sus accesos van antes que las
  // especialidades. Quien llega de afuera necesita el orden inverso.
  //
  // La galería y la ubicación van en franjas de color, y en los dos órdenes quedan
  // separadas por una sección sobre el papel: pegadas se leerían como un solo bloque.
  const guest = session.type === "guest";

  return (
    <div className="home">
      <Hero session={session} />
      {guest ? (
        <>
          <Specialities session={session} />
          <Gallery />
          <YourSpace session={session} />
        </>
      ) : (
        <>
          <YourSpace session={session} />
          <Gallery />
          <Specialities session={session} />
        </>
      )}
      <Location />
      <Footer />
    </div>
  );
}
