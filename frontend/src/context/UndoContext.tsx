import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

export interface Undoable {
  /** Lo que se lee cuando se deshizo. Contá cómo quedó la cosa, no qué tecla se apretó. */
  label: string;
  /** Lo que la vuelta atrás no alcanza a deshacer, si hay algo. Se avisa aparte. */
  note?: string;
  /** Cómo se vuelve al estado anterior. Tiene que dejar la pantalla al día. */
  undo: () => Promise<unknown>;
}

interface UndoContextValue {
  /**
   * Guarda cómo deshacer lo que se acaba de hacer, o `null` si no se puede deshacer.
   *
   * Pasar `null` no es lo mismo que no llamar: una acción irreversible tiene que borrar
   * la anterior, o Ctrl+Z revertiría algo de hace tres pasos creyendo que revierte lo
   * último.
   */
  remember: (action: Undoable | null) => void;
  undoLast: () => void;
}

/*
 * Sin proveedor, los atajos no hacen nada y las pantallas siguen andando.
 *
 * Es a propósito: `remember` lo llama la lógica de los turnos, que se usa desde varios
 * lados y también desde los tests. Que una pantalla reviente por no estar envuelta en un
 * contexto cuyo único trabajo es un atajo de teclado sería mucho peor que perderse el
 * atajo.
 */
const UndoContext = createContext<UndoContextValue>({ remember: () => {}, undoLast: () => {} });

/**
 * La última acción que se puede deshacer, y hasta cuándo.
 *
 * Dura lo que dura la pantalla: al cambiar de dirección se olvida. Es la regla que hace
 * que esto sea simple y honesto a la vez —no hay un historial que mantener al día contra
 * una base que mientras tanto cambió— y es lo que el cartel de atajos dice en voz alta,
 * porque una vez que te fuiste el cambio ya es definitivo.
 *
 * Se guarda en una `ref` y no en un estado: nada de la pantalla se dibuja distinto según
 * haya o no algo para deshacer, así que anotarlo en un estado sería volver a dibujar
 * todo después de cada acción para nada.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const ultima = useRef<Undoable | null>(null);
  const enCurso = useRef(false);
  const { pathname } = useLocation();

  useEffect(() => {
    ultima.current = null;
  }, [pathname]);

  const remember = useCallback((action: Undoable | null) => {
    ultima.current = action;
  }, []);

  const undoLast = useCallback(() => {
    const action = ultima.current;

    if (!action) {
      toast.info("No hay nada para deshacer en esta pantalla.");
      return;
    }

    if (enCurso.current) return;
    enCurso.current = true;

    // Se olvida antes de empezar: deshacer lo deshecho sería volver a hacerlo, y quien
    // aprieta Ctrl+Z dos veces está esperando ir dos pasos para atrás, no quedarse quieto.
    ultima.current = null;

    action
      .undo()
      .then(() => {
        toast.success(action.label);
        if (action.note) toast.warning(action.note);
      })
      .catch((err: Error) => toast.error(`No se pudo deshacer. ${err.message}`))
      .finally(() => {
        enCurso.current = false;
      });
  }, []);

  return <UndoContext.Provider value={{ remember, undoLast }}>{children}</UndoContext.Provider>;
}

export function useUndo() {
  return useContext(UndoContext);
}
