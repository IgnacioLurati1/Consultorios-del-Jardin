import { useSyncExternalStore } from "react";

/**
 * Una computadora: pantalla ancha y un mouse. El hall en 3D es solo para ahí: en el celular
 * no aparece ni se ofrece, y tampoco se baja three.js. Los 900 píxeles son el ancho desde el
 * que la escena está encuadrada para dejar la tarjeta del ingreso a un costado.
 */
const DESKTOP = "(min-width: 900px) and (hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(DESKTOP);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

// Sin matchMedia (las pruebas corren en jsdom) cuenta como celular.
function snapshot() {
  return window.matchMedia?.(DESKTOP).matches ?? false;
}

/** Si la pantalla es de computadora. Cambia sola si la ventana se achica o se agranda. */
export function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
