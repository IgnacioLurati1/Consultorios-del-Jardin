import { ToastContainer } from "react-toastify";

/**
 * Avisos de la app. Un solo lugar decide posición, duración y comportamiento,
 * así todas las pantallas se comportan igual. La estética vive en toast.css,
 * que se importa una vez desde index.css.
 */
export function Toasts() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      newestOnTop
      draggable={false}
      closeOnClick
      pauseOnHover
      hideProgressBar={false}
      theme="light"
    />
  );
}
