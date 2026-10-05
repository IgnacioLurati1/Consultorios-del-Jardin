import { Fragment, type ReactNode } from "react";
import { useAuth } from "../../../context/AuthContext";
import { PREVIEW_AS, useInstallation, type HomeBlock } from "../../../lib/installation";
import { HolidayGarland } from "../../../components/decor/HolidayDecor";
import { useHoliday } from "../../../components/decor/useHoliday";
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

  // En la vista previa de la configuración se mira como quien se eligió allá, no con la
  // sesión del administrador que está configurando.
  if (PREVIEW_AS === "visitante") return { type: "guest" };
  if (PREVIEW_AS === "paciente") return { type: "client" };

  return { type: (decoded?.type ?? "guest") as Session["type"] };
}

/**
 * Cómo se dibuja cada bloque.
 *
 * La portada no tiene un orden escrito: lo decide el consultorio (ver `homeBlocks` en
 * lib/installation) y llega del servidor, uno para quien entra de afuera y otro para quien
 * ya tiene cuenta. Un bloque nuevo se agrega acá, en la lista de lib/installation y en la
 * del servidor, que rechaza los que no conoce.
 */
const BLOCKS: Record<HomeBlock, (session: Session) => ReactNode> = {
  garland: () => <HolidayGarland />,
  hero: (session) => <Hero session={session} />,
  services: (session) => <Specialities session={session} />,
  gallery: () => <Gallery />,
  yourSpace: (session) => <YourSpace session={session} />,
  location: () => <Location />,
  footer: () => <Footer />,
};

export function Home() {
  const session = useSession();
  const { homeBlocks, homeTemplate } = useInstallation();

  // Si se festeja algo, la portada se adorna. El atributo lo leen los adornos chicos de
  // decor.css; la guirnalda de arriba se cuelga sola.
  const holiday = useHoliday();

  // Quien ya tiene cuenta viene a hacer algo: en el orden de siempre, sus accesos van antes
  // que las especialidades, y quien llega de afuera ve el orden inverso.
  //
  // La galería y la ubicación van en franjas de color. En los dos órdenes de siempre quedan
  // separadas por una sección sobre el papel, porque pegadas se leerían como un solo bloque:
  // quien arme otro orden en el panel conviene que lo respete.
  const blocks = session.type === "guest" ? homeBlocks.guest : homeBlocks.member;

  return (
    <div className="home" data-holiday={holiday ?? undefined} data-home-template={homeTemplate}>
      {blocks.map((block) => (
        <Fragment key={block}>{BLOCKS[block](session)}</Fragment>
      ))}
    </div>
  );
}
