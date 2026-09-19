/**
 * El contexto de audio de la noche, uno solo para todo el sitio. El navegador solo deja
 * sonar lo que arrancó con un gesto de quien usa la página: por eso el ingreso lo pide y
 * lo despierta en el mismo clic de "Entrar", antes de que se cargue la escena.
 */
let shared: AudioContext | null = null;

export function nightAudio(): AudioContext | null {
  if (shared) return shared;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    shared = new Ctor();
  } catch {
    return null;
  }
  return shared;
}

/** Lo despierta si estaba dormido. Se llama desde un clic o una tecla. */
export function wakeNightAudio() {
  const context = nightAudio();
  if (context?.state === "suspended") context.resume().catch(() => {});
}
