import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// La configuración de la instalación.
//
// Lo que se prueba primero no es que se pueda cambiar, sino que los valores por omisión
// sean exactamente los que el código tenía escritos. Mover un número del código a la base
// no tiene que cambiar nada de lo que ve nadie, y este archivo es el que lo sostiene: si
// alguien toca un default por conveniencia, acá se rompe.
//
// Después, los pisos. Un horizonte de cero días deja el consultorio sin turnos y un colchón
// más grande que el paso de la grilla deja la agenda a la mitad, así que ninguno de los dos
// se puede guardar.
// ============================================================

// La base guarda una copia y entrega copias, como la de verdad: lo que se cambia en la
// fila que devolvió una lectura no queda guardado hasta el flush. Sin eso, un cambio
// rechazado a mitad de camino quedaría escrito en el doble y la prueba de que un rechazo
// no deja nada a medias no probaría nada.
const { estado } = vi.hoisted(() => ({ estado: { guardada: null as any, consultas: 0 } }));

vi.mock("../shared/db/orm.js", async () => {
  const { Installation } = await import("../installation/installation.entity.js");

  const fork = () => {
    let enUso: any = null;
    const leer = () => (estado.guardada ? (enUso = Object.assign(new Installation(), estado.guardada)) : null);

    return {
      findOne: vi.fn(async () => {
        estado.consultas++;
        return leer();
      }),
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

import { config, forget, publicConfig, updateConfig } from "../installation/installation.service.js";

beforeEach(() => {
  estado.guardada = null;
  estado.consultas = 0;
  forget();
});

describe("los valores con los que arranca", () => {
  it("son los que el código tenía escritos, uno por uno", async () => {
    const c = await config();

    // Identidad
    expect(c.name).toBe("Consultorios del Jardín");
    expect(c.address).toBe("9 de Julio 3672");
    expect(c.city).toBe("Rosario");
    // El mismo texto que tenía el recordatorio, impersonal.
    expect(c.visitAdvice).toBe("Se recomienda llegar cinco minutos antes");
    expect(c.publicHours).toBe("Lunes a viernes, de 9 a 20");
    expect(c.instagram).toBe("consultorios_jardin");

    // Reglas, tal como estaban en el motor
    expect(c.bookingWeeksAhead).toBe(1); // esta semana y la que viene, lo que muestra la web
    expect(c.slotStepMinutes).toBe(null); // el paso era la duración del módulo
    expect(c.bufferMinutes).toBe(0); // no existía el colchón
    expect(c.realignToOpening).toBe(false); // engine:330 no realineaba
    expect(c.minNoticeMinutes).toBe(0); // se podía reservar para ahora mismo
    expect(c.shortNoticeHours).toBe(24); // shortNotice.ts:14
    expect(c.opensSunday).toBe(false); // engine:303
    expect(c.reminderHoursBefore).toBe(null); // la víspera
    expect(c.chargesMissed).toBe(false); // DEBT_FILTER excluía las ausencias
    expect(c.maxActiveAppointments).toBe(0); // no había tope
    expect(c.waitlistEnabled).toBe(true);
  });

  it("crea la fila la primera vez que alguien la pide", async () => {
    expect(estado.guardada).toBe(null);
    await config();
    expect(estado.guardada).not.toBe(null);
    expect(estado.guardada.id).toBe(1);
  });
});

describe("lo que queda en memoria", () => {
  it("no vuelve a preguntarle a la base en cada lectura", async () => {
    await config();
    const despuesDeLaPrimera = estado.consultas;

    await config();
    await config();

    expect(estado.consultas).toBe(despuesDeLaPrimera);
  });

  it("después de guardar, la siguiente lectura trae lo nuevo", async () => {
    await config();
    await updateConfig({ bookingWeeksAhead: 3 });

    expect((await config()).bookingWeeksAhead).toBe(3);
  });
});

describe("guardar cambios", () => {
  it("toca lo que viene y deja el resto", async () => {
    await config();

    const guardado = await updateConfig({ bookingWeeksAhead: 2 });

    expect(guardado.bookingWeeksAhead).toBe(2);
    expect(guardado.shortNoticeHours).toBe(24);
    expect(guardado.name).toBe("Consultorios del Jardín");
  });

  it("recorta los espacios de los textos", async () => {
    await config();

    const guardado = await updateConfig({ name: "  Consultorio Nuevo  " });

    expect(guardado.name).toBe("Consultorio Nuevo");
  });

  it("acepta vaciar el paso de la grilla, que significa usar la duración del módulo", async () => {
    await config();
    await updateConfig({ slotStepMinutes: 30 });

    expect((await updateConfig({ slotStepMinutes: null })).slotStepMinutes).toBe(null);
  });
});

describe("los pisos", () => {
  beforeEach(async () => {
    await config();
  });

  it("un horizonte de más de seis meses no se guarda", async () => {
    await expect(updateConfig({ bookingWeeksAhead: 27 })).rejects.toThrow("de 0 a 26");
    expect((await config()).bookingWeeksAhead).toBe(1);
  });

  it("un recordatorio de cero horas antes tampoco", async () => {
    await expect(updateConfig({ reminderHoursBefore: 0 })).rejects.toThrow("de 1 a 168");
  });

  it("un número con coma no es un número de minutos", async () => {
    await expect(updateConfig({ bufferMinutes: 7.5 })).rejects.toThrow("de 0 a 120");
  });

  it("un colchón que se come la grilla no se guarda", async () => {
    await updateConfig({ slotStepMinutes: 30 });

    await expect(updateConfig({ bufferMinutes: 30 })).rejects.toThrow("menor que el paso");
    await expect(updateConfig({ bufferMinutes: 45 })).rejects.toThrow("menor que el paso");

    // Uno que entra, sí.
    expect((await updateConfig({ bufferMinutes: 10 })).bufferMinutes).toBe(10);
  });

  it("el nombre no puede quedar vacío, porque sale en el asunto de los mails", async () => {
    await expect(updateConfig({ name: "   " })).rejects.toThrow("no puede quedar vacío");
  });

  it("un texto más largo que la columna se rechaza, no se corta", async () => {
    await expect(updateConfig({ name: "x".repeat(121) })).rejects.toThrow("120 caracteres");
    forget();
    expect((await config()).name).toBe("Consultorios del Jardín");
  });

  it("un pedido con un valor malo no guarda ninguno de los buenos", async () => {
    await expect(updateConfig({ bookingWeeksAhead: 3, bufferMinutes: 999 })).rejects.toThrow("de 0 a 120");

    // Se lee de la base y no de memoria: lo que importa es qué quedó guardado.
    forget();
    expect((await config()).bookingWeeksAhead).toBe(1);
  });
});

describe("lo que se le cuenta al navegador sin sesión", () => {
  it("trae la identidad y las reglas que la pantalla necesita", async () => {
    const publico = await publicConfig();

    expect(publico.name).toBe("Consultorios del Jardín");
    expect(publico.rules.bookingWeeksAhead).toBe(1);
    expect(publico.rules.shortNoticeHours).toBe(24);
  });

  it("no incluye nada que la pantalla no use", async () => {
    const publico: any = await publicConfig();

    // Si una ausencia se cobra es asunto del consultorio, no de quien pide un turno.
    expect(publico.rules.chargesMissed).toBeUndefined();
    expect(publico.rules.reminderHoursBefore).toBeUndefined();
  });
});

describe("la marca y la portada", () => {
  beforeEach(async () => {
    await config();
  });

  it("arrancan como estaban: color por estación, portada con collage y los bloques en su orden", async () => {
    const c = await config();

    expect(c.brandHue).toBe(null);
    expect(c.heroStyle).toBe("collage");
    expect(c.services).toEqual(["Psicología", "Psicopedagogía", "Psiquiatría", "Nutrición", "Fonoaudiología"]);
    expect(c.homeBlocksGuest).toEqual(["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"]);
    expect(c.homeBlocksMember).toEqual(["garland", "hero", "yourSpace", "gallery", "services", "location", "footer"]);
  });

  it("los bloques se pueden reordenar y sacar", async () => {
    const guardado = await updateConfig({ homeBlocksGuest: ["hero", "location", "footer"] });
    expect(guardado.homeBlocksGuest).toEqual(["hero", "location", "footer"]);
  });

  it("un bloque que la portada no sabe dibujar no se guarda", async () => {
    await expect(updateConfig({ homeBlocksGuest: ["hero", "carrusel3d"] })).rejects.toThrow('"carrusel3d"');
  });

  it("un bloque repetido tampoco", async () => {
    await expect(updateConfig({ homeBlocksGuest: "hero,hero" })).rejects.toThrow("dos veces");
  });

  it("el color de marca necesita tono y saturación juntos", async () => {
    await expect(updateConfig({ brandHue: 210 })).rejects.toThrow("tono y la saturación");

    const guardado = await updateConfig({ brandHue: 210, brandSaturation: 40 });
    expect([guardado.brandHue, guardado.brandSaturation]).toEqual([210, 40]);

    // Y se puede volver a la estación.
    const vuelta = await updateConfig({ brandHue: null, brandSaturation: null });
    expect(vuelta.brandHue).toBe(null);
  });

  it("la portada solo acepta los estilos que existen", async () => {
    await expect(updateConfig({ heroStyle: "video" })).rejects.toThrow("collage, foto o texto");
    expect((await updateConfig({ heroStyle: "text" })).heroStyle).toBe("text");
  });

  it("los servicios llegan como lista y se guardan limpios", async () => {
    const guardado = await updateConfig({ services: [" Kinesiología ", "", "Nutrición"] });
    expect(guardado.services).toEqual(["Kinesiología", "Nutrición"]);
  });

  it("lo público trae la marca y los bloques", async () => {
    const publico: any = await publicConfig();

    expect(publico.brand).toEqual({ hue: null, saturation: null });
    expect(publico.homeBlocks.guest[0]).toBe("garland");
    expect(publico.services).toHaveLength(5);
  });
});

describe("el contacto y el mapa", () => {
  beforeEach(async () => {
    await config();
  });

  it("el mapa solo puede ser uno de Google, porque va en un iframe", async () => {
    await expect(updateConfig({ mapEmbedUrl: "https://sitio-cualquiera.com/pagina" })).rejects.toThrow("Google Maps");

    const url = "https://www.google.com/maps/embed?pb=!1m18!abc";
    expect((await updateConfig({ mapEmbedUrl: url })).mapEmbedUrl).toBe(url);
  });

  it("vacío, el mapa se arma con la dirección", async () => {
    expect((await updateConfig({ mapEmbedUrl: "" })).mapEmbedUrl).toBe(null);
  });

  it("el link de cómo llegar tiene que ser https", async () => {
    await expect(updateConfig({ directionsUrl: "http://mapa.com" })).rejects.toThrow("https://");
    expect((await updateConfig({ directionsUrl: "" })).directionsUrl).toBe(null);
  });

  it("una casilla rota no se publica", async () => {
    await expect(updateConfig({ email: "sin-arroba" })).rejects.toThrow("no parece válida");
  });

  it("el teléfono y el WhatsApp arrancan vacíos y solo aceptan números", async () => {
    const antes = await config();
    expect(antes.phone).toBe("");
    expect(antes.whatsapp).toBe("");

    await expect(updateConfig({ phone: "llamar a la tarde" })).rejects.toThrow("teléfono no parece válido");
    await expect(updateConfig({ whatsapp: "341 555" })).rejects.toThrow("código de país");

    const guardado = await updateConfig({ phone: "(0341) 555-1234", whatsapp: "+54 9 341 555 1234" });
    expect(guardado.phone).toBe("(0341) 555-1234");
    expect((await publicConfig()).whatsapp).toBe("+54 9 341 555 1234");
    expect((await updateConfig({ phone: "" })).phone).toBe("");
  });

  it("las preguntas y los motivos de siempre no se guardan: Jardín sigue con los de hoy", async () => {
    const c = await config();
    expect(c.faq.map((item) => item.id)).toEqual([
      "donde",
      "especialidades",
      "responsable",
      "costo",
      "solicitar",
      "cancelar",
      "elegir",
      "indicaciones",
      "datos",
      "sumarse",
    ]);
    expect(c.contactReasons.map((item) => item.id)).toEqual(["turnos", "profesional", "sugerencia", "otro"]);

    await updateConfig({ faq: c.faq, contactReasons: c.contactReasons });
    expect(estado.guardada.faq).toBe(null);
    expect(estado.guardada.contactReasons).toBe(null);
  });

  it("una pregunta propia se suma, una de siempre se oculta o se reescribe", async () => {
    const c = await config();
    const faq = [
      { id: "p1", question: "¿Hay estacionamiento?", answer: "Sí, en la esquina.", hidden: false },
      ...c.faq.map((item) => (item.id === "costo" ? { ...item, hidden: true } : item.id === "datos" ? { ...item, answer: "Otro texto." } : item)),
    ];

    const guardado = await updateConfig({ faq });
    expect(guardado.faq[0]).toEqual({ id: "p1", question: "¿Hay estacionamiento?", answer: "Sí, en la esquina.", hidden: false });
    expect(guardado.faq.find((item) => item.id === "costo")?.hidden).toBe(true);
    expect(guardado.faq.find((item) => item.id === "datos")?.answer).toBe("Otro texto.");
    expect((await publicConfig()).faq).toHaveLength(11);
  });

  it("una pregunta de siempre no se borra, y una propia necesita respuesta", async () => {
    const c = await config();
    await expect(updateConfig({ faq: c.faq.filter((item) => item.id !== "costo") })).rejects.toThrow("se ocultan");
    await expect(updateConfig({ faq: [...c.faq, { id: "p1", question: "¿Hay estacionamiento?", answer: "" }] })).rejects.toThrow(
      "Falta la respuesta"
    );
  });

  it("los motivos: uno propio se suma, y alguno tiene que quedar a la vista", async () => {
    const c = await config();
    const propios = [...c.contactReasons, { id: "m1", label: "Facturación", hint: "Pedidos de factura.", hidden: false }];
    expect((await updateConfig({ contactReasons: propios })).contactReasons).toHaveLength(5);

    const todosOcultos = propios.map((item) => ({ ...item, hidden: true }));
    await expect(updateConfig({ contactReasons: todosOcultos })).rejects.toThrow("al menos un motivo");
  });

  it("el diseño de cada sección: sin elegir sigue al general, y uno desconocido se rechaza", async () => {
    expect((await config()).homeVariants).toEqual({});

    const guardado = await updateConfig({ homeVariants: { services: "mosaic", footer: "columns", gallery: null } });
    expect(guardado.homeVariants).toEqual({ services: "mosaic", footer: "columns" });
    expect((await publicConfig()).homeVariants).toEqual({ services: "mosaic", footer: "columns" });

    await expect(updateConfig({ homeVariants: { services: "ruleta" } })).rejects.toThrow("Ese diseño no existe");
    await expect(updateConfig({ homeVariants: { menu: "cards" } })).rejects.toThrow("no tiene una sección");

    await updateConfig({ homeVariants: {} });
    expect(estado.guardada.homeVariants).toBe(null);
  });

  it("los colores propios: sin elegir siguen a la marca, y uno que no es color se rechaza", async () => {
    expect((await config()).elementColors).toEqual({});

    const guardado = await updateConfig({ elementColors: { header: "#1E3A5F", mail: "", footer: null } });
    expect(guardado.elementColors).toEqual({ header: "#1e3a5f" });
    expect((await publicConfig()).elementColors).toEqual({ header: "#1e3a5f" });

    await expect(updateConfig({ elementColors: { header: "azul" } })).rejects.toThrow("tiene que ser como");
    await expect(updateConfig({ elementColors: { botones: "#000000" } })).rejects.toThrow("No hay un elemento");
  });

  it("el recorrido 3D no se prende ni se apaga desde el panel", async () => {
    const guardado = await updateConfig({ spaceTour: false });
    expect(guardado.spaceTour).toBe(true);
  });
});

describe("con qué datos nace una instalación", () => {
  afterEach(() => {
    delete process.env.TOKEN_ISSUER;
  });

  it("la de Jardín nace con los datos de Jardín, como siempre", async () => {
    process.env.TOKEN_ISSUER = "jardin";
    const c = await config();

    expect(c.name).toBe("Consultorios del Jardín");
    expect(c.spaceTour).toBe(true);
  });

  it("una nueva no nace con el nombre, la dirección ni el recorrido de otro consultorio", async () => {
    process.env.TOKEN_ISSUER = "kinesur";
    const c = await config();

    expect(c.name).toBe("Consultorio");
    for (const campo of ["address", "city", "publicHours", "instagram", "email", "tagline"] as const) {
      expect(c[campo]).toBe("");
    }
    expect(c.services).toEqual([]);
    expect(c.mapEmbedUrl).toBe(null);
    expect(c.spaceTour).toBe(false);
    expect(c.heroStyle).toBe("text");
  });

  it("las reglas de turnos nacen iguales en todas", async () => {
    process.env.TOKEN_ISSUER = "kinesur";
    const c = await config();

    expect(c.bookingWeeksAhead).toBe(1);
    expect(c.shortNoticeHours).toBe(24);
  });
});

describe("el estilo de los paneles", () => {
  beforeEach(async () => {
    await config();
  });

  it("arranca en el de siempre", async () => {
    expect((await config()).panelSkin).toBe("jardin");
  });

  it("acepta los que existen y rechaza los que no", async () => {
    expect((await updateConfig({ panelSkin: "clinico" })).panelSkin).toBe("clinico");
    await expect(updateConfig({ panelSkin: "neon" })).rejects.toThrow("no existe");
  });

  it("va en lo público, porque lo dibuja la web antes de que nadie entre", async () => {
    expect(((await publicConfig()) as any).panelSkin).toBe("jardin");
  });
});

describe("el diseño de la portada", () => {
  beforeEach(async () => {
    await config();
  });

  it("arranca en el de siempre, acepta los que existen y rechaza los que no", async () => {
    expect((await config()).homeTemplate).toBe("jardin");
    expect((await updateConfig({ homeTemplate: "minimal" })).homeTemplate).toBe("minimal");
    await expect(updateConfig({ homeTemplate: "brutalista" })).rejects.toThrow("no existe");
  });
});
