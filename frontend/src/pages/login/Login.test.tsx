import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Login } from "./Login";
import { BrowserRouter } from "react-router-dom";
import * as jwtDecodeModule from "jwt-decode";
import * as AuthContextModule from "../../context/AuthContext";
import { ThemeProvider } from "../../context/ThemeContext";
import * as LoginServiceModule from "./loginServices";

// --- MOCKS ---

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn(),
}));

const mockedLoginContext = vi.fn();
vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
  login: mockedLoginContext,
  logout: vi.fn(),
  token: null,
  restoring: false,
});

vi.mock("./loginServices", () => ({
  LoginService: vi.fn(),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // El logo del formulario cambia con el tema, así que la pantalla necesita el proveedor
  // del tema además del router. Sin él no se dibuja nada y fallan las siete pruebas.
  const renderComponent = () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <Login />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  const signIn = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
    await user.type(screen.getByLabelText(/Email/i), email);
    await user.type(screen.getByLabelText(/Contraseña/i), password);
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));
  };

  it("muestra los dos campos y el botón de entrar", () => {
    renderComponent();

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Entrar$/i })).toBeInTheDocument();
  });

  it("no llama al servicio con el formulario vacío", async () => {
    renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));

    expect(await screen.findByText(/Escribí tu email/i)).toBeInTheDocument();
    expect(LoginServiceModule.LoginService).not.toHaveBeenCalled();
  });

  it("avisa si el email no tiene formato válido", async () => {
    renderComponent();
    const user = userEvent.setup();

    await signIn(user, "no-es-un-email", "123456");

    expect(await screen.findByText(/no parece válido/i)).toBeInTheDocument();
    expect(LoginServiceModule.LoginService).not.toHaveBeenCalled();
  });

  it("pide la contraseña si falta", async () => {
    renderComponent();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Email/i), "cliente@test.com");
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));

    expect(await screen.findByText(/Escribí tu contraseña/i)).toBeInTheDocument();
    expect(LoginServiceModule.LoginService).not.toHaveBeenCalled();
  });

  it("inicia sesión y manda al paciente a la home", async () => {
    renderComponent();
    const user = userEvent.setup();
    const fakeToken = "token.falso.cliente";

    (LoginServiceModule.LoginService as any).mockResolvedValue({ token: fakeToken });
    (jwtDecodeModule.jwtDecode as any).mockReturnValue({ type: "client" });

    await signIn(user, "cliente@test.com", "123456");

    await waitFor(() => {
      expect(LoginServiceModule.LoginService).toHaveBeenCalledWith("cliente@test.com", "123456");
      expect(mockedLoginContext).toHaveBeenCalledWith(fakeToken);
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("manda al admin a su panel", async () => {
    renderComponent();
    const user = userEvent.setup();

    (LoginServiceModule.LoginService as any).mockResolvedValue({ token: "token.falso.admin" });
    (jwtDecodeModule.jwtDecode as any).mockReturnValue({ type: "admin" });

    await signIn(user, "admin@test.com", "admin123");

    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith("/AdminHome"));
  });

  it("muestra el error del servidor sin borrar lo escrito", async () => {
    renderComponent();
    const user = userEvent.setup();
    const errorMsg = "Credenciales inválidas";

    (LoginServiceModule.LoginService as any).mockRejectedValue(new Error(errorMsg));

    await signIn(user, "fail@test.com", "wrongpass");

    expect(await screen.findByText(errorMsg)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toHaveValue("fail@test.com");
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});
