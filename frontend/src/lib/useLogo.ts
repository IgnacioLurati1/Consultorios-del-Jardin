import { useTheme } from "../context/ThemeContext";
import logoPadded from "../assets/Logo.png";
import logoPaddedDark from "../assets/LogoOscuro.png";
import logoTight from "../assets/LogoRecortado.png";
import logoTightDark from "../assets/LogoRecortadoOscuro.png";

/**
 * El logo con el nombre, en la versión que se lee sobre el fondo del tema.
 *
 * El original está escrito en negro: sobre el gris oscuro se pierde y quedan las dos
 * hojitas flotando solas. La versión clara es un archivo aparte y no un filtro CSS
 * porque las hojas tienen que seguir siendo verdes: invertir la imagen las volvería
 * fucsia, y bajarle el contraste al negro lo deja gris sobre gris.
 *
 * Las dos versiones están recortadas al mismo encuadre relativo, así que al cambiar de
 * tema el logo no se mueve ni cambia de tamaño.
 *
 * `padded` es el que tiene aire alrededor (el del menú lateral); `tight` es el ajustado
 * al dibujo, que usan el login y los formularios.
 */
export function useLogo(framing: "tight" | "padded" = "tight"): string {
  const { theme } = useTheme();

  if (framing === "padded") return theme === "dark" ? logoPaddedDark : logoPadded;
  return theme === "dark" ? logoTightDark : logoTight;
}
