import { describe, it, expect } from "vitest";
import { DEFAULT_MAIL_IDENTITY, button, paragraph, shell } from "../config/mailTemplate.js";

// ============================================================
// El sobre de los mails.
//
// Con los datos de siempre tiene que decir lo que decía. Con otro consultorio, no puede
// quedar nada de este: ni el nombre, ni la dirección, ni el verde.
// ============================================================

const contenido = [paragraph("Hola"), button("Ver mis turnos", "https://ejemplo.com/turnos")].join("");

describe("con los datos de siempre", () => {
  const html = shell(contenido, { baseUrl: "https://consultoriosdeljardin.com.ar", mail: "hola@ejemplo.com" });

  it("dice el nombre, la dirección y el horario del consultorio", () => {
    expect(html).toContain("<title>Consultorios del Jardín</title>");
    expect(html).toContain("<strong>9 de Julio 3672</strong>");
    expect(html).toContain("Lunes a viernes, de 9 a 20");
    expect(html).toContain("@consultorios_jardin");
  });

  it("lleva los servicios en la cabecera, en el orden de la web", () => {
    expect(html).toContain("Psicología · Psicopedagogía · Psiquiatría · Nutrición · Fonoaudiología");
  });

  it("sale en el verde de siempre", () => {
    expect(html).toContain("#3b7658");
    expect(html).toContain("#2f5e46");
  });
});

describe("con otro consultorio", () => {
  const otro = {
    name: "Centro Kinésico Sur",
    address: "Av. Siempre Viva 742",
    publicHours: "Lunes a sábado, de 8 a 13",
    instagram: "",
    services: ["Kinesiología"],
    brand: { hue: 210, saturation: 45 },
  };

  // Un link escrito a mano con el verde, como hacen varios mails.
  const conLink = `${contenido}<a href="#" style="color:#2f5e46">link</a>`;
  const html = shell(conLink, { baseUrl: "https://ejemplo.com", mail: "hola@ejemplo.com", identity: otro });

  it("no queda nada del de antes", () => {
    for (const viejo of ["Consultorios del Jardín", "9 de Julio", "consultorios_jardin", "Psicología"]) {
      expect(html).not.toContain(viejo);
    }
  });

  it("dice lo suyo", () => {
    expect(html).toContain("<title>Centro Kinésico Sur</title>");
    expect(html).toContain("Av. Siempre Viva 742");
    expect(html).toContain("Kinesiología");
  });

  it("sin Instagram, el pie no muestra un link vacío", () => {
    expect(html).not.toContain("instagram.com");
  });

  it("no queda ningún verde de la marca vieja, tampoco en los links escritos a mano", () => {
    for (const verde of ["#3b7658", "#2f5e46", "#e8f1ec", "#cfe3d6"]) expect(html.toLowerCase()).not.toContain(verde);
  });

  it("y la crema del pie, que no es de la marca, sigue igual", () => {
    expect(html).toContain("#fefae0");
  });
});

describe("lo que escribe el consultorio pasa escapado", () => {
  it("un nombre con signos no rompe el HTML", () => {
    const html = shell(contenido, {
      identity: { ...DEFAULT_MAIL_IDENTITY, name: "Salud <Integral> & Cía" },
    });

    expect(html).toContain("Salud &lt;Integral&gt; &amp; Cía");
    expect(html).not.toContain("<Integral>");
  });
});
