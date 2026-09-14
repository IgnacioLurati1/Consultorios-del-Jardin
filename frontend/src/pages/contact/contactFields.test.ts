import { describe, expect, it } from "vitest";
import { APPLICATION, MAX_CV_BYTES, emptyContactForm, validateCv, validatePerson } from "./contactFields";

const person = { ...emptyContactForm, name: "Ana Pérez", email: "ana@mail.com" };

describe("contacto - quiero trabajar acá", () => {
  it("pide el teléfono solo en una postulación", () => {
    expect(validatePerson({ ...person, reason: "turnos" })).toBeNull();
    expect(validatePerson({ ...person, reason: APPLICATION })).toBe("Falta el teléfono");
    expect(validatePerson({ ...person, reason: APPLICATION, phone: "341 555 5555" })).toBeNull();
  });

  it("el CV es opcional, PDF o Word y hasta 5 MB", () => {
    expect(validateCv(null)).toBeNull();
    expect(validateCv(new File(["x"], "cv.pdf"))).toBeNull();
    expect(validateCv(new File(["x"], "cv.docx"))).toBeNull();
    expect(validateCv(new File(["x"], "foto.jpg"))).toBe("El CV tiene que ser PDF o Word");

    const big = new File(["x"], "cv.pdf");
    Object.defineProperty(big, "size", { value: MAX_CV_BYTES + 1 });
    expect(validateCv(big)).toBe("El CV supera los 5 MB");
  });
});
