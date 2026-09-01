import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Recarga mostrando el indicador de "tirar para actualizar" en vez del esqueleto. */
  refreshing: boolean;
  reload: () => void;
  refresh: () => void;
  /** Para cuando una acción ya sabe el resultado y no hace falta volver a pedir todo. */
  set: (value: T) => void;
}

/**
 * Pide datos y lleva la cuenta de los tres estados que toda pantalla necesita: cargando,
 * roto y listo. Sin esto cada pantalla se escribe sus tres useState y alguna se olvida
 * del error.
 *
 * `deps` es lo que hace que se vuelva a pedir: cambiar el profesional elegido, el día, el
 * filtro.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  useEffect(() => {
    let alive = true;

    if (!refreshing) setLoading(true);
    setError(null);

    run()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((problem) => {
        if (alive) setError(errorMessage(problem));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((value) => value + 1);
  }, []);

  return { data, loading: loading && !refreshing, error, refreshing, reload, refresh, set: setData };
}
