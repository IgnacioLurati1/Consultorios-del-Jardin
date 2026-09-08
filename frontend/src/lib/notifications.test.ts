import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La campanita, del lado de la pantalla.
 *
 * Lo que se decide acá es poco y bien delimitado: traducir lo que manda el servidor a lo
 * que la pantalla dibuja, y no romper nada cuando el servidor no contesta. La regla de
 * qué es una novedad vive del otro lado.
 */

const { get, post, borrar } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), borrar: vi.fn() }));

vi.mock("../axios", () => ({ default: { get, post, delete: borrar } }));

import { dismissAll, dismissNotification, fetchNotifications, markSeen } from "./notifications";

/** Un aviso como lo manda el servidor. */
function delServidor(extra: Record<string, unknown> = {}) {
  return {
    id: 7,
    title: "Te confirmaron el turno",
    body: "Llegá cinco minutos antes.",
    tone: "good",
    target: "appointments",
    at: "2026-09-08T12:30:00.000Z",
    read: false,
    ...extra,
  };
}

function contesta(data: unknown[], unread = 0) {
  get.mockResolvedValue({ data: { data, unread } });
}

describe("Traer los avisos", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    borrar.mockReset();
  });

  it("trae lo que hay y cuántos faltan ver", async () => {
    contesta([delServidor()], 1);

    const { lista, sinVer } = await fetchNotifications();

    expect(lista).toHaveLength(1);
    expect(lista[0].title).toBe("Te confirmaron el turno");
    expect(lista[0].read).toBe(false);
    expect(sinVer).toBe(1);
  });

  it("la fecha llega como texto y se usa como número", async () => {
    contesta([delServidor()]);

    const { lista } = await fetchNotifications();

    expect(lista[0].at).toBe(new Date("2026-09-08T12:30:00.000Z").getTime());
  });

  /*
   * El servidor manda a qué pantalla lleva cada aviso, no la dirección. La página y la
   * aplicación del teléfono tienen rutas distintas para lo mismo, así que la dirección la
   * pone cada una.
   */
  it("traduce el destino a una dirección de esta aplicación", async () => {
    contesta([
      delServidor({ id: 1, target: "appointments" }),
      delServidor({ id: 2, target: "booking" }),
      delServidor({ id: 3, target: "security" }),
    ]);

    const { lista } = await fetchNotifications();

    expect(lista.map((a) => a.to)).toEqual(["/AppointmentsList", "/Appointment", "/AdminHome/Analytics"]);
  });

  it("un aviso sin destino no lleva a ningún lado", async () => {
    contesta([delServidor({ target: null })]);

    expect((await fetchNotifications()).lista[0].to).toBeNull();
  });

  /*
   * El servidor y la página se publican por separado. Un destino que esta versión todavía
   * no conoce no puede dejar la campanita rota: queda sin destino, que es lo mismo que ya
   * hace un aviso de algo que no está en ninguna pantalla.
   */
  it("un destino que no conoce lo deja sin destino, y no rompe", async () => {
    contesta([delServidor({ target: "pantalla-que-no-existe-todavia" })]);

    const { lista } = await fetchNotifications();

    expect(lista).toHaveLength(1);
    expect(lista[0].to).toBeNull();
  });

  it("un aviso sin cuerpo se dibuja igual", async () => {
    contesta([delServidor({ body: null })]);

    expect((await fetchNotifications()).lista[0].body).toBeUndefined();
  });

  /*
   * Quien entró a hacer otra cosa no tiene por qué recibir un error porque un aviso no se
   * pudo traer. Vale también para un servidor todavía sin esta pantalla.
   */
  it("si el servidor no contesta, no hay novedades y no hay error", async () => {
    get.mockRejectedValue(new Error("se cayó la red"));

    await expect(fetchNotifications()).resolves.toEqual({ lista: [], sinVer: 0 });
  });

  it("una respuesta rara tampoco rompe nada", async () => {
    get.mockResolvedValue({ data: {} });

    await expect(fetchNotifications()).resolves.toEqual({ lista: [], sinVer: 0 });
  });
});

describe("Marcar y borrar", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    borrar.mockReset();
  });

  it("abrir la campanita marca todo como visto", async () => {
    post.mockResolvedValue({});

    await markSeen();

    expect(post).toHaveBeenCalledWith("/notifications/seen");
  });

  it("borrar uno lo borra por su número", async () => {
    borrar.mockResolvedValue({});

    await dismissNotification(12);

    expect(borrar).toHaveBeenCalledWith("/notifications/12");
  });

  it("borrar todo", async () => {
    borrar.mockResolvedValue({});

    await dismissAll();

    expect(borrar).toHaveBeenCalledWith("/notifications");
  });

  // La pantalla ya sacó el aviso de la lista cuando esto vuelve. Fallar acá no le devuelve
  // nada a nadie y encima tira un error arriba de algo que la persona da por hecho.
  it("si falla, no explota", async () => {
    post.mockRejectedValue(new Error("no anda"));
    borrar.mockRejectedValue(new Error("no anda"));

    await expect(markSeen()).resolves.toBeUndefined();
    await expect(dismissNotification(1)).resolves.toBeUndefined();
    await expect(dismissAll()).resolves.toBeUndefined();
  });
});
