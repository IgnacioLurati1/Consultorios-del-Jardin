import * as SecureStore from "expo-secure-store";

/**
 * Dónde se guardan los tokens de la sesión.
 *
 * En el teléfono, en el llavero del sistema: Keychain en iOS, Keystore en Android. Otra
 * aplicación no puede leerlos y no quedan escritos en texto plano.
 *
 * Hay una versión `.web.ts` al lado, que Metro usa cuando la app corre en el navegador.
 * Existe solo para poder mirar las pantallas desde una computadora mientras se
 * desarrolla; el navegador no es un destino de esta app.
 */
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
