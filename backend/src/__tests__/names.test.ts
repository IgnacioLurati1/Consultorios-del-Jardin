import { describe, it, expect } from "vitest";
import { properName } from "../shared/names.js";
import {
  canonicalSpeciality,
  normalizeSpeciality,
  normalizeSpecialityList,
  specialityKey,
  stylesFor,
} from "../shared/specialities.js";
import { Person } from "../people/people.entity.js";

// ============================================================
// Nombres de personas y de especialidades, escritos siempre igual.
// ============================================================

describe("los nombres de las personas", () => {
  it("toda en minúscula o toda en mayúscula, queda con la inicial en mayúscula", () => {
    expect(properName("juan pérez")).toBe("Juan Pérez");
    expect(properName("MARÍA JOSÉ")).toBe("María José");
    expect(properName("ñandú")).toBe("Ñandú");
  });

  it("los espacios de más se van", () => {
    expect(properName("  ana   laura ")).toBe("Ana Laura");
  });

  it("lo que ya mezcla mayúsculas se respeta", () => {
    expect(properName("McDonald")).toBe("McDonald");
    expect(properName("diCaprio")).toBe("diCaprio");
  });

  it("las partículas del medio van en minúscula, y al principio con mayúscula", () => {
    expect(properName("maría de los ángeles")).toBe("María de los Ángeles");
    expect(properName("JUAN DEL VALLE")).toBe("Juan del Valle");
    expect(properName("da silva")).toBe("Da Silva");
  });

  it("los compuestos con guion o apóstrofo llevan mayúscula en cada parte", () => {
    expect(properName("ana-laura o'brien")).toBe("Ana-Laura O'Brien");
  });

  it("se aplican solas al guardar una persona, entre por donde entre", () => {
    const person = Object.assign(new Person(), { name: "lucía", surname: "GÓMEZ de la torre" });
    person.normalizeNames();

    expect(person.name).toBe("Lucía");
    expect(person.surname).toBe("Gómez de la Torre");
  });
});

describe("las especialidades", () => {
  it("las conocidas recuperan sus tildes y su mayúscula", () => {
    expect(normalizeSpeciality("psicologia")).toBe("Psicología");
    expect(normalizeSpeciality("  FONOAUDIOLOGIA. ")).toBe("Fonoaudiología");
    expect(normalizeSpeciality("terapia ocupacional")).toBe("Terapia ocupacional");
  });

  it("las demás quedan como en una oración, con las siglas como vienen", () => {
    expect(normalizeSpeciality("YOGA PARA EMBARAZADAS")).toBe("Yoga para embarazadas");
    expect(normalizeSpeciality("terapia EMDR")).toBe("Terapia EMDR");
  });

  it("la lista sale sin vacías ni repetidas, en el orden en que llegó", () => {
    expect(normalizeSpecialityList(["nutricion", "", "Psicología", "PSICOLOGIA", "Nutrición "])).toEqual(["Nutrición", "Psicología"]);
  });

  it("las cinco de Jardín quedan exactamente como estaban", () => {
    const jardin = ["Psicología", "Psicopedagogía", "Psiquiatría", "Nutrición", "Fonoaudiología"];
    expect(normalizeSpecialityList(jardin)).toEqual(jardin);
  });

  it("la de cada profesional se busca en la lista sin importar tildes ni mayúsculas", () => {
    expect(canonicalSpeciality("psicologia", ["Psicología", "Nutrición"])).toBe("Psicología");
    expect(canonicalSpeciality("Kinesiología", ["Psicología"])).toBe(null);
    expect(specialityKey(" Psicología ")).toBe("psicologia");
  });

  it("el ícono y la foto quedan solo para las que están en la lista, y validados", () => {
    const styles = stylesFor(
      {
        psicologia: { icon: "brain", imageId: "0123456789abcdef01234567" },
        Nutrición: { icon: "inventado", imageId: "../../etc/passwd" },
        Kinesiología: { icon: "run" },
      },
      ["Psicología", "Nutrición"]
    );

    expect(styles).toEqual({ Psicología: { icon: "brain", imageId: "0123456789abcdef01234567" } });
  });
});
