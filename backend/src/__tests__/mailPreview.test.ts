import { describe, it, expect, vi } from "vitest";

// ============================================================
// La vista previa de un mail en la configuración.
//
// Tiene que ser el mail de verdad con lo que se está editando, y no mandar ni guardar nada.
// ============================================================

vi.mock("../installation/installation.service.js", async () =>
  (await import("./helpers/installationDefaults.js")).installationServiceMock()
);

import { previewMail } from "../installation/mailPreview.js";

describe("la vista previa de un mail", () => {
  it("sin cambios, es el mail de siempre con los datos guardados", async () => {
    const mail = await previewMail("confirmado");

    expect(mail.subject).toBe("Tu turno está confirmado");
    expect(mail.html).toContain("<title>Consultorios del Jardín</title>");
    expect(mail.html).toContain("Se recomienda llegar cinco minutos antes");
  });

  it("con otras palabras y otro nombre, muestra lo que se está editando", async () => {
    const mail = await previewMail("confirmado", {
      name: "Estudio Prana",
      vocabulary: { turno: { one: "clase", many: "clases", gender: "f" } },
      brandHue: 280,
      brandSaturation: 40,
    });

    expect(mail.subject).toBe("Tu clase está confirmada");
    expect(mail.html).toContain("<title>Estudio Prana</title>");
    expect(mail.html).not.toContain("#3b7658");
  });

  it("palabras que no sirven se rechazan con el motivo", async () => {
    await expect(previewMail("pedido", { vocabulary: { turno: { one: "", many: "x", gender: "f" } } })).rejects.toThrow(
      "Falta el singular"
    );
  });

  it("un mail que no existe, tampoco", async () => {
    await expect(previewMail("factura")).rejects.toThrow("no tiene vista previa");
  });

  it("todos los tipos se arman", async () => {
    for (const kind of ["pedido", "confirmado", "recordatorio", "cancelado", "profesional"]) {
      const mail = await previewMail(kind);
      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.html).toContain("<!DOCTYPE html>");
    }
  });
});
