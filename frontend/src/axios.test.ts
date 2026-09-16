import axios, { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renewSession } from "./axios";

/** Una respuesta del servidor con ese código. */
function answered(status: number) {
  return new AxiosError(`status ${status}`, "ERR_BAD_RESPONSE", undefined, undefined, { status } as never);
}

/** Sin respuesta: sin señal, o el servidor caído. */
function noAnswer() {
  return new AxiosError("Network Error", "ERR_NETWORK");
}

describe("renewSession", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "acceso-vencido");
    localStorage.setItem("refreshToken", "refresh-guardado");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sin respuesta del servidor no cierra la sesión", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(noAnswer());

    const result = await renewSession();

    expect(result).toEqual({ token: null, offline: true });
    expect(localStorage.getItem("refreshToken")).toBe("refresh-guardado");
  });

  it("un error del servidor tampoco la cierra", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(answered(502));

    const result = await renewSession();

    expect(result.offline).toBe(true);
    expect(localStorage.getItem("refreshToken")).toBe("refresh-guardado");
  });

  it("si el servidor la rechaza por las dos vías, la cierra", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(answered(403));

    const result = await renewSession();

    expect(result).toEqual({ token: null, offline: false });
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("si una vía rechaza y la otra no contesta, la sesión queda para después", async () => {
    vi.spyOn(axios, "get").mockRejectedValueOnce(answered(403)).mockRejectedValueOnce(noAnswer());

    const result = await renewSession();

    expect(result.offline).toBe(true);
    expect(localStorage.getItem("refreshToken")).toBe("refresh-guardado");
  });

  it("con un token nuevo lo guarda y lo devuelve", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { token: "acceso-nuevo" } });

    const result = await renewSession();

    expect(result).toEqual({ token: "acceso-nuevo", offline: false });
    expect(localStorage.getItem("token")).toBe("acceso-nuevo");
  });

  describe("en Brave", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "brave", { value: {}, configurable: true });
    });

    afterEach(() => {
      delete (navigator as { brave?: unknown }).brave;
    });

    it("no borra la copia aunque la cookie alcance sola", async () => {
      // Brave tira la cookie al cerrar la pestaña: la copia es lo que sostiene la sesión.
      vi.spyOn(axios, "get").mockRejectedValueOnce(answered(401)).mockResolvedValueOnce({ data: { token: "acceso-nuevo" } });

      await renewSession();

      expect(localStorage.getItem("refreshToken")).toBe("refresh-guardado");
      expect(localStorage.getItem("refresh-por-cookie")).not.toBe("1");
    });

    it("renueva con la copia aunque haya quedado la marca de la cookie", async () => {
      localStorage.setItem("refresh-por-cookie", "1");
      const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { token: "acceso-nuevo" } });

      await renewSession();

      expect(get.mock.calls[0][1]?.headers).toMatchObject({ "X-Refresh-Token": "refresh-guardado" });
    });
  });

  it("fuera de Brave, si la cookie alcanza sola, borra la copia", async () => {
    vi.spyOn(axios, "get").mockRejectedValueOnce(answered(401)).mockResolvedValueOnce({ data: { token: "acceso-nuevo" } });

    await renewSession();

    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("refresh-por-cookie")).toBe("1");
  });

  it("varias renovaciones juntas comparten un solo pedido", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { token: "acceso-nuevo" } });

    const [a, b, c] = await Promise.all([renewSession(), renewSession(), renewSession()]);

    expect(get).toHaveBeenCalledTimes(1);
    expect([a.token, b.token, c.token]).toEqual(["acceso-nuevo", "acceso-nuevo", "acceso-nuevo"]);
  });
});
