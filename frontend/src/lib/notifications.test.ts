import { beforeEach, describe, expect, it } from "vitest";
import {
  applySnapshot,
  dismissAll,
  dismissNotification,
  forgetNotifications,
  markSeen,
  readNotifications,
  readSeenMark,
  type AppNotification,
} from "./notifications";

const YO = "luis@demo.local";

function aviso(id: string, at = Date.now()): AppNotification {
  return { id, title: id, tone: "info", at, to: null };
}

describe("Los avisos de la campanita", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "avisos-visto=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("la primera vez no avisa nada, solo guarda cómo estaban las cosas", () => {
    const lista = applySnapshot(YO, { t1: "accepted" }, () => [aviso("no-deberia-salir")]);

    expect(lista).toEqual([]);
    expect(readNotifications(YO)).toEqual([]);
  });

  it("la segunda vez sí avisa, y le pasa la foto anterior a quien compara", () => {
    applySnapshot(YO, { t1: "pending" }, () => []);

    let vista: Record<string, string> | null = null;
    const lista = applySnapshot(YO, { t1: "accepted" }, (antes) => {
      vista = antes;
      return [aviso("t1:confirmado")];
    });

    expect(vista).toEqual({ t1: "pending" });
    expect(lista.map((a) => a.id)).toEqual(["t1:confirmado"]);
  });

  it("el mismo aviso no se anota dos veces", () => {
    applySnapshot(YO, { t1: "pending" }, () => []);
    applySnapshot(YO, { t1: "accepted" }, () => [aviso("t1:confirmado")]);
    applySnapshot(YO, { t1: "accepted" }, () => [aviso("t1:confirmado")]);

    expect(readNotifications(YO)).toHaveLength(1);
  });

  it("lo de hace más de tres días se cae solo", () => {
    const haceCuatroDias = Date.now() - 4 * 24 * 60 * 60 * 1000;

    applySnapshot(YO, { t1: "pending" }, () => []);
    applySnapshot(YO, { t1: "accepted" }, () => [aviso("viejo", haceCuatroDias), aviso("nuevo")]);

    expect(readNotifications(YO).map((a) => a.id)).toEqual(["nuevo"]);
  });

  it("los ordena del más nuevo al más viejo", () => {
    applySnapshot(YO, { t1: "a" }, () => []);
    applySnapshot(YO, { t1: "b" }, () => [aviso("antes", Date.now() - 60000), aviso("recien")]);

    expect(readNotifications(YO).map((a) => a.id)).toEqual(["recien", "antes"]);
  });

  it("abrir la campana marca hasta dónde se leyó", () => {
    expect(readSeenMark(YO)).toBe(0);

    markSeen(YO);

    expect(readSeenMark(YO)).toBeGreaterThan(0);
  });

  it("se puede borrar uno, y borrarlos todos", () => {
    applySnapshot(YO, { t1: "a" }, () => []);
    applySnapshot(YO, { t1: "b" }, () => [aviso("uno"), aviso("dos")]);

    dismissNotification(YO, "uno");
    expect(readNotifications(YO).map((a) => a.id)).toEqual(["dos"]);

    dismissAll(YO);
    expect(readNotifications(YO)).toEqual([]);
  });

  /* Lo borrado no vuelve aunque la foto siga igual: la foto ya se había guardado, así que
     el hecho no se vuelve a detectar. Es lo que hace que borrar signifique algo. */
  it("lo borrado no vuelve en la siguiente vuelta", () => {
    applySnapshot(YO, { t1: "a" }, () => []);
    applySnapshot(YO, { t1: "b" }, () => [aviso("uno")]);
    dismissNotification(YO, "uno");

    applySnapshot(YO, { t1: "b" }, (antes) => (antes.t1 === "b" ? [] : [aviso("uno")]));

    expect(readNotifications(YO)).toEqual([]);
  });

  it("cada persona tiene los suyos", () => {
    applySnapshot(YO, { t1: "a" }, () => []);
    applySnapshot(YO, { t1: "b" }, () => [aviso("mio")]);

    expect(readNotifications("otra@demo.local")).toEqual([]);
  });

  it("cerrar sesión se los lleva", () => {
    applySnapshot(YO, { t1: "a" }, () => []);
    applySnapshot(YO, { t1: "b" }, () => [aviso("mio")]);

    forgetNotifications(YO);

    expect(readNotifications(YO)).toEqual([]);
  });
});
