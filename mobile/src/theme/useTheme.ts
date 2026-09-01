import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { Colors, palette } from "./tokens";

export interface Theme {
  colors: Colors;
  dark: boolean;
}

/**
 * La app sigue el modo del teléfono. No hay un interruptor propio: un usuario que puso
 * el celular en oscuro ya eligió, y darle un segundo lugar donde elegir lo mismo es
 * ruido.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  return useMemo(() => ({ colors: dark ? palette.dark : palette.light, dark }), [dark]);
}
