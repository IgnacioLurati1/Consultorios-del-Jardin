import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpacePage } from "./SpacePage";
import { ThemeProvider } from "../../context/ThemeContext";
import { SeasonProvider } from "../../context/SeasonContext";

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

const renderSpace = () =>
  render(
    <ThemeProvider>
      <SeasonProvider>
        <MemoryRouter initialEntries={["/espacio"]}>
          <Routes>
            <Route path="/" element={<p>Inicio</p>} />
            <Route path="/espacio" element={<SpacePage />} />
          </Routes>
        </MemoryRouter>
      </SeasonProvider>
    </ThemeProvider>
  );

describe("SpacePage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("en la computadora muestra el hall solo, sin formulario", () => {
    screenIs(true);
    const { container } = renderSpace();

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("desde el celular vuelve al inicio", () => {
    screenIs(false);
    renderSpace();

    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });
});
