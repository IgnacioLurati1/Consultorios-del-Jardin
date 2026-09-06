import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

type Notifications = typeof import("expo-notifications");

/**
 * El acceso a expo-notifications, que no en todos lados se puede cargar.
 *
 * Desde el SDK 55 el módulo, apenas se importa, registra un listener de token de push
 * para reenviarlo a un servidor. En Expo Go sobre Android ese registro lanza una
 * excepción, porque las notificaciones remotas se sacaron de Expo Go. Como pasa mientras
 * se evalúa el módulo, no alcanza con no llamar a nada de push: el `import` solo ya
 * rompe la app entera. Y como de acá cuelga el layout, se caen todas las pantallas: cada
 * ruta queda sin su export por defecto y no abre ninguna.
 *
 * Por eso se carga a mano y recién cuando hace falta. Donde no se puede, las funciones de
 * aviso no hacen nada y la app sigue andando, que es lo que ya pretendía el código: el
 * aviso es una comodidad, no el turno. En un build de verdad, y en Expo Go sobre iOS, se
 * carga como siempre.
 */
export const canNotify = !(Platform.OS === "android" && isRunningInExpoGo());

let loaded: Notifications | null = null;

/** El módulo, o null si en este teléfono no se puede usar. */
export function notifications(): Notifications | null {
  if (!canNotify) return null;

  // Diferido a propósito: un import arriba de todo se evalúa igual aunque no se llame.
  loaded ??= require("expo-notifications") as Notifications;
  return loaded;
}
