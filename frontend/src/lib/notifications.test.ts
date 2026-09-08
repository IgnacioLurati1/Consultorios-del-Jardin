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

/**
 * Qué pasa cuando una vuelta no puede preguntar todo.
 *
 * Es el caso que rompía los avisos. Los recolectores tapaban el error con una lista
 * vacía, la foto se guardaba vacía y la vuelta siguiente la leía como la primera de
 * todas: lo que hubiera cambiado en el medio no se avisaba nunca.
 */
describe("Los avisos cuando el servidor no contesta", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "avisos-visto=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  /** Emite solo si el turno cambió de estado, como hacen los recolectores de verdad. */
  const alCambiar = (ahora: string) => (antes: Record<string, string>) =>
    antes.t1 && antes.t1 !== ahora ? [aviso(`t1:${antes.t1}->${ahora}`)] : [];

  it("el cambio que pasó mientras el servidor estaba caído se avisa después", () => {
    applySnapshot(YO, { t1: "pending" }, alCambiar("pending"));

    // No se pudo preguntar por los turnos: la foto de turnos no se toca.
    applySnapshot(YO, {}, () => [], ["t"]);

    const lista = applySnapshot(YO, { t1: "accepted" }, alCambiar("accepted"));

    expect(lista.map((a) => a.id)).toEqual(["t1:pending->accepted"]);
  });

  it("aguanta varias vueltas caídas seguidas sin perder la referencia", () => {
    applySnapshot(YO, { t1: "pending" }, alCambiar("pending"));

    for (let vuelta = 0; vuelta < 5; vuelta++) applySnapshot(YO, {}, () => [], ["t"]);

    expect(applySnapshot(YO, { t1: "accepted" }, alCambiar("accepted")).map((a) => a.id)).toEqual([
      "t1:pending->accepted",
    ]);
  });

  // La otra punta del mismo problema. Sin conservar las claves, la vuelta siguiente ve
  // cada turno sin huella previa y los anuncia todos como recién aparecidos.
  it("no anuncia como nuevos los turnos que ya estaban", () => {
    const comoNuevo = (antes: Record<string, string>) =>
      ["t1", "t2", "t3"].filter((clave) => antes[clave] === undefined).map((clave) => aviso(`${clave}:nuevo`));

    applySnapshot(YO, { t1: "a", t2: "a", t3: "a" }, comoNuevo);
    applySnapshot(YO, {}, () => [], ["t"]);

    expect(applySnapshot(YO, { t1: "a", t2: "a", t3: "a" }, comoNuevo)).toEqual([]);
  });

  it("lo que sí se pudo preguntar se sigue avisando igual", () => {
    applySnapshot(YO, { t1: "pending", av9: "Cerramos el viernes" }, () => []);

    // Fallan los turnos, no los anuncios: el anuncio nuevo tiene que salir igual.
    const lista = applySnapshot(
      YO,
      { av9: "Cerramos el viernes", av10: "Mudamos la sala" },
      (antes) => (antes.av10 === undefined ? [aviso("av10")] : []),
      ["t"]
    );

    expect(lista.map((a) => a.id)).toEqual(["av10"]);
  });

  it("un turno que de verdad desapareció sale de la foto", () => {
    applySnapshot(YO, { t1: "a", t2: "a" }, () => []);
    // Vuelta buena en la que t2 ya no viene: no es un fallo, el turno no está más.
    applySnapshot(YO, { t1: "a" }, () => []);

    const visto: Record<string, string>[] = [];
    applySnapshot(YO, { t1: "a" }, (antes) => {
      visto.push(antes);
      return [];
    });

    expect(visto[0]).toEqual({ t1: "a" });
  });

  // Si la primera foto de todas sale incompleta y se guarda igual, la próxima vuelta deja
  // de contar como primera y anuncia como nuevo todo lo que la parte que falló no registró.
  it("una primera vuelta incompleta no se guarda a medias", () => {
    applySnapshot(YO, { av9: "Cerramos el viernes" }, () => [], ["t"]);

    // Sigue siendo la primera vez, así que no emite nada y recién ahora guarda la foto.
    const lista = applySnapshot(YO, { t1: "pending", av9: "Cerramos el viernes" }, () => [aviso("no-deberia-salir")]);

    expect(lista).toEqual([]);
    expect(applySnapshot(YO, { t1: "accepted", av9: "Cerramos el viernes" }, alCambiar("accepted")).map((a) => a.id)).toEqual([
      "t1:pending->accepted",
    ]);
  });
});
