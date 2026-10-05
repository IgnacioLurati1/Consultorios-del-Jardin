import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// La ruta de salud.
//
// Es pública y abierta a cualquier origen, así que lo que más importa probar no es que
// conteste sino lo que no dice: nada de variables de entorno, ni personas, ni el texto de
// un error de la base. Y después, que distinga una base caída de una tarea atrasada, y
// que una tarea que todavía no tuvo tiempo de correr no aparezca como atrasada.
//
// La base es un doble: una consulta trivial que anda o no, y la última vuelta de cada
// tarea en un mapa por nombre.
// ============================================================

const { estado } = vi.hoisted(() => ({
  estado: {
    baseCaida: false,
    baseColgada: false,
    lecturasDeBase: 0,
    ultimas: {} as Record<string, Date | null>,
    tareas: [] as { name: string; everyMinutes: number }[],
  },
}));

vi.mock("../shared/db/orm.js", () => {
  const em: any = {
    getConnection: () => ({
      execute: vi.fn(async () => {
        estado.lecturasDeBase++;
        if (estado.baseColgada) return new Promise(() => {});
        if (estado.baseCaida) throw new Error("connect ECONNREFUSED usuario@host-secreto:3306");
        return [{ 1: 1 }];
      }),
    }),
    findOne: vi.fn(async (_entity: any, where: any) => {
      const nombre = String(where.key.$like).replace(/:%$/, "");
      const fecha = estado.ultimas[nombre];
      return fecha ? { key: `${nombre}:1`, startedAt: fecha } : null;
    }),
    fork: vi.fn(() => em),
  };

  return { orm: { em } };
});

vi.mock("../shared/jobs/schedule.js", () => ({
  scheduledJobs: () => estado.tareas.map((tarea) => ({ ...tarea })),
}));

import { getHealth, lateAfterMinutes, measureHealth, resetHealthCache, shortVersion } from "../health/health.service.js";
import { health, healthCors } from "../health/health.controller.js";

const AHORA = new Date("2026-10-05T15:00:00.000Z");
const minutosAntes = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000);

/** Un res de mentira que se queda con lo último que le dijeron. */
function fakeRes() {
  const res: any = {
    code: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    ended: false,
    status(code: number) {
      res.code = code;
      return res;
    },
    json(body: any) {
      res.body = body;
      return res;
    },
    setHeader(nombre: string, valor: string) {
      res.headers[nombre.toLowerCase()] = valor;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  estado.baseCaida = false;
  estado.baseColgada = false;
  estado.lecturasDeBase = 0;
  estado.tareas = [
    { name: "cierre", everyMinutes: 5 },
    { name: "recordatorios", everyMinutes: 60 },
    { name: "recurrencias", everyMinutes: 1440 },
  ];
  estado.ultimas = {
    cierre: minutosAntes(3),
    recordatorios: minutosAntes(50),
    recurrencias: minutosAntes(20 * 60),
  };
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  resetHealthCache();
});

describe("la versión", () => {
  it("es el commit de Railway, corto", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "3F9A2C1D4E5B6A7980112233445566778899AABB";
    expect(shortVersion()).toBe("3f9a2c1");
  });

  it("sin la variable, no hay versión", () => {
    expect(shortVersion()).toBeNull();
  });

  it("algo que no es un commit no sale por la ruta", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "mysql://usuario:clave@host/base";
    expect(shortVersion()).toBeNull();
  });
});

describe("la medición", () => {
  it("todo al día", async () => {
    const informe = await measureHealth({ now: AHORA, uptimeSeconds: 3600 });

    expect(informe.ok).toBe(true);
    expect(informe.db).toBe("ok");
    expect(informe.time).toBe(AHORA.toISOString());
    expect(informe.jobs).toEqual([
      { name: "cierre", lastRun: minutosAntes(3).toISOString(), late: false },
      { name: "recordatorios", lastRun: minutosAntes(50).toISOString(), late: false },
      { name: "recurrencias", lastRun: minutosAntes(20 * 60).toISOString(), late: false },
    ]);
  });

  it("una tarea pasada de su margen queda atrasada, y el conjunto deja de estar bien", async () => {
    // Cada cinco minutos, con diez de margen: a los dieciséis ya está atrasada.
    estado.ultimas.cierre = minutosAntes(16);

    const informe = await measureHealth({ now: AHORA, uptimeSeconds: 3600 });

    expect(informe.ok).toBe(false);
    expect(informe.db).toBe("ok");
    expect(informe.jobs?.find((tarea) => tarea.name === "cierre")?.late).toBe(true);
    expect(informe.jobs?.find((tarea) => tarea.name === "recordatorios")?.late).toBe(false);
  });

  it("el margen es la mitad del período, y nunca menos de diez minutos", () => {
    expect(lateAfterMinutes(5)).toBe(15);
    expect(lateAfterMinutes(60)).toBe(90);
    expect(lateAfterMinutes(1440)).toBe(2160);
  });

  it("sin ninguna vuelta registrada, recién desplegado no es un atraso", async () => {
    estado.ultimas = {};

    const recien = await measureHealth({ now: AHORA, uptimeSeconds: 5 * 60 });
    expect(recien.jobs?.every((tarea) => tarea.lastRun === null && !tarea.late)).toBe(true);
    expect(recien.ok).toBe(true);

    // Con el proceso vivo desde hace dos horas, la de cada cinco minutos ya tendría que haber corrido.
    const despues = await measureHealth({ now: AHORA, uptimeSeconds: 2 * 3600 });
    expect(despues.jobs?.find((tarea) => tarea.name === "cierre")?.late).toBe(true);
    expect(despues.jobs?.find((tarea) => tarea.name === "recurrencias")?.late).toBe(false);
  });

  it("con la base caída dice error, sin el motivo y sin tareas", async () => {
    estado.baseCaida = true;

    const informe = await measureHealth({ now: AHORA, uptimeSeconds: 3600 });

    expect(informe).toEqual({ ok: false, time: AHORA.toISOString(), version: null, db: "error", jobs: null });
    expect(JSON.stringify(informe)).not.toContain("host-secreto");
  });

  it("una base que no contesta se da por caída, no cuelga la ruta", async () => {
    estado.baseColgada = true;

    const informe = await measureHealth({ now: AHORA, uptimeSeconds: 3600, timeoutMs: 20 });

    expect(informe.db).toBe("error");
    expect(informe.ok).toBe(false);
  });
});

describe("lo que no dice", () => {
  it("solo las claves previstas, y ningún valor de entorno", async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "abcdef0123456789";
    process.env.OWNER_EMAILS = "dueño@ejemplo.com";
    process.env.JWT_SECRET = "clave-que-no-tiene-que-salir";

    const informe = await measureHealth({ now: AHORA, uptimeSeconds: 3600 });
    const texto = JSON.stringify(informe);

    expect(Object.keys(informe).sort()).toEqual(["db", "jobs", "ok", "time", "version"]);
    for (const tarea of informe.jobs ?? []) expect(Object.keys(tarea).sort()).toEqual(["lastRun", "late", "name"]);
    expect(texto).not.toContain("dueño@ejemplo.com");
    expect(texto).not.toContain("clave-que-no-tiene-que-salir");
    expect(texto).not.toContain("abcdef0123456789");
  });
});

describe("la caché", () => {
  it("dos pedidos seguidos miden una sola vez, y la hora es la de cada pedido", async () => {
    const primero = await getHealth(AHORA);
    const segundo = await getHealth(new Date(AHORA.getTime() + 5_000));

    expect(estado.lecturasDeBase).toBe(1);
    expect(segundo.time).toBe(new Date(AHORA.getTime() + 5_000).toISOString());
    expect(segundo.db).toBe(primero.db);
  });

  it("pasados unos segundos vuelve a medir", async () => {
    await getHealth(AHORA);
    await getHealth(new Date(AHORA.getTime() + 60_000));

    expect(estado.lecturasDeBase).toBe(2);
  });
});

describe("la respuesta", () => {
  // El controlador mide con la hora del reloj. Se fija para que las fechas de arriba no
  // dependan del día en que corre la prueba; los temporizadores siguen siendo los de verdad.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("abierta a cualquier origen, sin credenciales y sin guardarse", async () => {
    const res = fakeRes();
    const next = vi.fn();

    healthCors({ method: "GET", headers: { origin: "https://ignaciolurati1.github.io" } } as any, res, next);
    await health({} as any, res);

    expect(next).toHaveBeenCalled();
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.code).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("el preflight se contesta ahí mismo", () => {
    const res = fakeRes();
    const next = vi.fn();

    healthCors({ method: "OPTIONS", headers: {} } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers["access-control-allow-methods"]).toBe("GET, OPTIONS");
  });

  it("con la base caída, 503", async () => {
    estado.baseCaida = true;
    const res = fakeRes();

    await health({} as any, res);

    expect(res.code).toBe(503);
    expect(res.body.db).toBe("error");
  });

  it("con una tarea atrasada sigue siendo 200, con ok en false", async () => {
    estado.ultimas.recordatorios = minutosAntes(3 * 60);
    const res = fakeRes();

    await health({} as any, res);

    expect(res.code).toBe(200);
    expect(res.body.ok).toBe(false);
  });
});
