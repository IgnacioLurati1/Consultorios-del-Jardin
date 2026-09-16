import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteCookie, readCookie } from "../../../lib/cookies.ts";
import { ProfessionalGuide } from "./ProfessionalGuide.tsx";
import { GUIDE_STEPS } from "./guideSteps.ts";
import { GUIDE_COOKIE, useProfessionalGuide } from "./useProfessionalGuide.ts";

/** Lo mínimo del panel: el botón de ayuda y la guía, con el mismo hook que usa el panel. */
function Panel() {
  const guide = useProfessionalGuide();
  return (
    <>
      <button type="button" onClick={guide.openGuide}>
        Ayuda
      </button>
      <ProfessionalGuide open={guide.open} onClose={guide.closeGuide} />
    </>
  );
}

describe("guía del panel del profesional", () => {
  beforeEach(() => deleteCookie(GUIDE_COOKIE));

  it("se abre sola la primera vez", () => {
    render(<Panel />);
    expect(screen.getByRole("dialog", { name: "Cómo funciona el panel" })).toBeInTheDocument();
    expect(screen.getByText("Bienvenido/a al panel")).toBeInTheDocument();
  });

  // Cerrarla en el primer paso ya es decir que no: no se vuelve a abrir sola.
  it("cerrada una vez, no vuelve a abrirse sola", async () => {
    const { unmount } = render(<Panel />);
    await userEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readCookie(GUIDE_COOKIE)).toBe("1");

    unmount();
    render(<Panel />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("recorre los pasos y se vuelve a abrir desde el botón de ayuda, desde el principio", async () => {
    render(<Panel />);

    await userEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Turno normal")).toBeInTheDocument();
    expect(screen.getByText("Turnos › Nuevo turno")).toBeInTheDocument();

    // Derecho al último tramo de la barra, y de ahí a cerrar.
    const ultimo = GUIDE_STEPS[GUIDE_STEPS.length - 1];
    await userEvent.click(screen.getByRole("button", { name: `Paso ${GUIDE_STEPS.length}, ${ultimo.title}` }));
    await userEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ayuda" }));
    expect(screen.getByText("Bienvenido/a al panel")).toBeInTheDocument();
  });

  // La regla de los textos de la web: en pantalla no van dos puntos.
  it("no usa dos puntos en ningún paso", () => {
    for (const step of GUIDE_STEPS) {
      expect(`${step.title} ${step.text} ${step.where ?? ""}`).not.toContain(":");
    }
  });
});
