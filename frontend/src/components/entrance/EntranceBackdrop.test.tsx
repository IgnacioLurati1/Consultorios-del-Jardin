import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntranceBackdrop } from "./EntranceBackdrop";
import { ThemeProvider } from "../../context/ThemeContext";
import { SeasonProvider } from "../../context/SeasonContext";
import { deleteCookie, readCookie, writeCookie } from "../../lib/cookies";

// jsdom no trae matchMedia. Acá se decide qué pantalla simula cada prueba: una computadora
// (ancha y con mouse) o un celular.
function screenIs(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("pointer: fine"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const renderBackdrop = () =>
  render(
    <ThemeProvider>
      <SeasonProvider>
        <EntranceBackdrop />
      </SeasonProvider>
    </ThemeProvider>
  );

describe("EntranceBackdrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    deleteCookie("fondo-ingreso");
  });

  it("en la computadora arranca oculto e invita a verlo", () => {
    screenIs(true);
    const { container } = renderBackdrop();

    expect(screen.getByRole("button", { name: "¿Querés ver nuestro espacio común?" })).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("al aceptar lo muestra y lo recuerda", async () => {
    screenIs(true);
    const { container } = renderBackdrop();

    await userEvent.click(screen.getByRole("button", { name: "¿Querés ver nuestro espacio común?" }));

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Ocultar fondo" })).toBeInTheDocument();
    expect(readCookie("fondo-ingreso")).toBe("on");
  });

  it("quien ya lo abrió lo encuentra abierto", () => {
    screenIs(true);
    writeCookie("fondo-ingreso", "on");
    const { container } = renderBackdrop();

    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("en el celular no aparece ni se ofrece", () => {
    screenIs(false);
    writeCookie("fondo-ingreso", "on");
    const { container } = renderBackdrop();

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
