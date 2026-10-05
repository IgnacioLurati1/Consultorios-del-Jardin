import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// Las reglas de funcionamiento.
//
// Son las que pasan un turnero de autogestionado a cerrado. Lo que se prueba:
// - con todas en su valor de siempre, el sistema hace lo que hacía antes;
// - cada valor se valida, y uno roto no deja la instalación sin funcionar;
// - el consultorio cambia las suyas pero no las del dueño ni las que él bloqueó;
// - los modos impuestos ganan sobre lo que eligió cada profesional, sin tocar lo viejo.
// ============================================================

const { estado } = vi.hoisted(() => ({ estado: { guardada: null as any } }));

vi.mock("../shared/db/orm.js", async () => {
  const { Installation } = await import("../installation/installation.entity.js");

  const fork = () => {
    let enUso: any = null;
    const leer = () => (estado.guardada ? (enUso = Object.assign(new Installation(), estado.guardada)) : null);
    return {
      findOne: vi.fn(async () => leer()),
      findOneOrFail: vi.fn(async () => leer()),
      create: vi.fn((_entidad: any, data: any) => {
        enUso = Object.assign(new Installation(), data);
        return enUso;
      }),
      flush: vi.fn(async () => {
        if (enUso) estado.guardada = { ...enUso };
      }),
      clear: vi.fn(() => {}),
      // Las especialidades alinean a los profesionales y limpian fotos sueltas.
      find: vi.fn(async () => []),
      nativeDelete: vi.fn(async () => 0),
    };
  };

  return { orm: { em: { fork } } };
});

import { config, forget, publicConfig, rulesView, updateConfig } from "../installation/installation.service.js";
import {
  DEFAULT_POLICIES,
  POLICY_DEFS,
  POLICY_PRESETS,
  acceptsAutomatically,
  applyPolicyChanges,
  markFor,
  payFor,
  policiesOf,
  policyCatalog,
} from "../shared/policies.js";
import { words } from "../shared/vocabulary.js";
import { configureRentModules, moduleOf } from "../rent/rent.rules.js";

beforeEach(() => {
  estado.guardada = null;
  forget();
});

afterEach(() => {
  delete process.env.TOKEN_ISSUER;
  configureRentModules("09:00-13:00", "14:00-20:00");
});

describe("con los valores de siempre", () => {
  it("todo está permitido y nada se impone, como antes de que existieran las reglas", async () => {
    const { policies, locked } = await config();

    expect(policies).toEqual(DEFAULT_POLICIES);
    expect(locked).toEqual([]);
    for (const key of ["patientBooking", "patientCancel", "openSignup", "proCreate", "proOverbook", "proEdit", "proCancel"] as const)
      expect(policies[key]).toBe(true);
    expect(policies.acceptMode).toBe("each");
    expect(policies.markMode).toBe("each");
    expect(policies.payMode).toBe("each");
  });

  it("Jardín nace con alquileres y una instalación nueva sin", async () => {
    process.env.TOKEN_ISSUER = "jardin";
    expect((await config()).policies.rentModule).toBe(true);

    estado.guardada = null;
    forget();
    process.env.TOKEN_ISSUER = "kinesur";
    expect((await config()).policies.rentModule).toBe(false);
  });

  it("lo público trae las reglas, sin las fechas internas", async () => {
    const publico: any = await publicConfig();

    expect(publico.policies.patientBooking).toBe(true);
    expect(publico.policies.markSince).toBeUndefined();
    expect(publico.policies.paySince).toBeUndefined();
  });
});

describe("leer lo guardado", () => {
  it("un JSON roto o vacío da los valores de siempre", () => {
    expect(policiesOf(null)).toEqual(DEFAULT_POLICIES);
    expect(policiesOf("{no es json")).toEqual(DEFAULT_POLICIES);
    expect(policiesOf("[1,2]")).toEqual(DEFAULT_POLICIES);
  });

  it("un valor que ya no vale se queda con el de siempre y no tumba a los demás", () => {
    const leidas = policiesOf(JSON.stringify({ acceptMode: "a veces", proEdit: false }));

    expect(leidas.acceptMode).toBe("each");
    expect(leidas.proEdit).toBe(false);
  });
});

describe("validar lo que llega", () => {
  it("cada tipo se controla", () => {
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { proEdit: "no" })).toThrow();
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { acceptMode: "a veces" })).toThrow();
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { cancelNoticeHours: 200 })).toThrow();
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { cancelNoticeHours: 1.5 })).toThrow();
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { rentMorning: "9 a 13" })).toThrow();
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { inventada: true })).toThrow();
  });

  it("los módulos de alquiler van en orden y duran distinto", () => {
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { rentMorning: "09:00-15:00" })).toThrow(/antes de que empiece/);
    expect(() => applyPolicyChanges(DEFAULT_POLICIES, { rentMorning: "08:00-14:00" })).toThrow(/durar distinto/);
    expect(applyPolicyChanges(DEFAULT_POLICIES, { rentMorning: "08:00-12:00", rentAfternoon: "13:00-18:00" }).rentAfternoon).toBe(
      "13:00-18:00"
    );
  });

  it("imponer el cierre o el cobro anota desde cuándo, y dejar de imponerlo lo borra", () => {
    const ahora = new Date("2026-10-05T12:00:00Z");
    const impuesto = applyPolicyChanges(DEFAULT_POLICIES, { markMode: "assisted", payMode: "always" }, ahora);

    expect(impuesto.markSince).toBe(ahora.toISOString());
    expect(impuesto.paySince).toBe(ahora.toISOString());

    const suelto = applyPolicyChanges(impuesto, { markMode: "each", payMode: "never" });
    expect(suelto.markSince).toBe(null);
    expect(suelto.paySince).toBe(null);
  });
});

describe("quién cambia qué", () => {
  it("el consultorio cambia una regla suya", async () => {
    const c = await updateConfig({ policies: { proEdit: false } }, "client");
    expect(c.policies.proEdit).toBe(false);
  });

  it("el consultorio no toca las del dueño", async () => {
    await expect(updateConfig({ policies: { rentModule: false } }, "client")).rejects.toThrow("no se puede cambiar");
    await expect(updateConfig({ policies: { assistant: "off" } }, "client")).rejects.toThrow("no se puede cambiar");
  });

  it("ni las que el dueño bloqueó, sean del JSON o de su propia columna", async () => {
    await updateConfig({ locked: ["acceptMode", "bookingWeeksAhead"] }, "owner");

    await expect(updateConfig({ policies: { acceptMode: "never" } }, "client")).rejects.toThrow("no se puede cambiar");
    await expect(updateConfig({ bookingWeeksAhead: 3 }, "client")).rejects.toThrow("no se puede cambiar");
    // Las que no bloqueó, sí.
    expect((await updateConfig({ minNoticeMinutes: 30 }, "client")).minNoticeMinutes).toBe(30);
  });

  it("el consultorio tampoco cambia los bloqueos", async () => {
    await expect(updateConfig({ locked: [] }, "client")).rejects.toThrow("no se puede cambiar");
  });

  it("el dueño cambia todas, y solo bloquea las que el consultorio ve", async () => {
    const c = await updateConfig({ policies: { rentModule: false, assistant: "staff" } }, "owner");
    expect(c.policies.rentModule).toBe(false);
    expect(c.policies.assistant).toBe("staff");

    await expect(updateConfig({ locked: ["rentModule"] }, "owner")).rejects.toThrow("No se puede bloquear");
  });
});

describe("el catálogo", () => {
  it("el consultorio ve solo las suyas, con las bloqueadas marcadas", async () => {
    await updateConfig({ locked: ["proEdit"] }, "owner");
    const vista = await rulesView("client");

    expect(vista.rules.some((rule) => rule.key === "rentModule")).toBe(false);
    expect(vista.rules.find((rule) => rule.key === "proEdit")?.locked).toBe(true);
    expect(vista.rules.find((rule) => rule.key === "proCreate")?.locked).toBe(false);
  });

  it("el dueño las ve todas", async () => {
    const vista = await rulesView("owner");
    expect(vista.rules.map((rule) => rule.key)).toEqual(POLICY_DEFS.map((def) => def.key));
  });

  it("los textos salen con las palabras del rubro", () => {
    const w = words({
      turno: { one: "cita", many: "citas", gender: "f" },
      profesional: { one: "terapeuta", many: "terapeutas", gender: "m" },
      paciente: { one: "consultante", many: "consultantes", gender: "m" },
      lugar: { one: "estudio", many: "estudios", gender: "m" },
      sala: { one: "box", many: "boxes", gender: "m" },
      especialidad: { one: "disciplina", many: "disciplinas", gender: "f" },
      sucursal: { one: "sede", many: "sedes", gender: "f" },
    });
    const { rules } = policyCatalog(w, {}, [], "owner");

    expect(rules.find((rule) => rule.key === "patientBooking")?.label).toBe("Los consultantes piden cita desde la web y la app");
    expect(rules.find((rule) => rule.key === "proCancel")?.label).toBe("Cancela citas confirmadas");
  });

  it("ningún texto lleva dos puntos, como el resto de la web", () => {
    const { rules, groups } = policyCatalog(words(), {}, [], "owner");
    const textos = [
      ...groups.map((group) => group.title),
      ...rules.flatMap((rule) => [rule.label, rule.hint ?? "", rule.nullLabel ?? "", ...(rule.options ?? []).map((o) => o.label)]),
    ];
    for (const texto of textos) expect(texto).not.toContain(":");
  });

  it("lo que depende de otra regla se esconde cuando no aplica", () => {
    const { rules } = policyCatalog(words(), { markMode: "each", patientCancel: false }, [], "client");

    expect(rules.find((rule) => rule.key === "markWhen")?.visible).toBe(false);
    expect(rules.find((rule) => rule.key === "cancelNoticeHours")?.visible).toBe(false);
  });

  it("los dos puntos de partida solo usan reglas que existen y valores válidos", () => {
    for (const preset of POLICY_PRESETS) expect(() => applyPolicyChanges(DEFAULT_POLICIES, preset.values)).not.toThrow();
  });
});

describe("lo que la regla quiere decir para cada profesional", () => {
  const profesional = {
    autoAccept: false,
    autoMark: null,
    autoMarkWhen: "appointment" as const,
    autoMarkSince: null,
    autoPay: true,
    autoPayWhen: "day" as const,
    autoPaySince: new Date("2026-01-01"),
  };

  it("con 'cada uno', manda lo que eligió el profesional", () => {
    expect(acceptsAutomatically(DEFAULT_POLICIES, profesional)).toBe(false);
    expect(markFor(DEFAULT_POLICIES, profesional)).toBe(null);
    expect(payFor(DEFAULT_POLICIES, profesional)).toEqual({ when: "day", since: new Date("2026-01-01") });
  });

  it("impuesto, gana sobre lo que eligió, desde que se impuso", () => {
    const reglas = applyPolicyChanges(
      DEFAULT_POLICIES,
      { acceptMode: "always", markMode: "missed", markWhen: "day", payMode: "never" },
      new Date("2026-10-05T12:00:00Z")
    );

    expect(acceptsAutomatically(reglas, profesional)).toBe(true);
    expect(markFor(reglas, profesional)).toEqual({ state: "missed", when: "day", since: new Date("2026-10-05T12:00:00Z") });
    expect(payFor(reglas, profesional)).toBe(null);
  });
});

describe("los módulos de alquiler de cada instalación", () => {
  it("con los de siempre, cuatro horas es mañana, seis tarde y más es el día", () => {
    expect(moduleOf(240)).toBe("morning");
    expect(moduleOf(360)).toBe("afternoon");
    expect(moduleOf(420)).toBe("day");
    expect(moduleOf(300)).toBe(null);
  });

  it("con otros, el precio sale de lo que dura cada uno", () => {
    configureRentModules("08:00-11:00", "12:00-17:00");

    expect(moduleOf(180)).toBe("morning");
    expect(moduleOf(300)).toBe("afternoon");
    expect(moduleOf(301)).toBe("day");
    expect(moduleOf(240)).toBe(null);
  });
});
