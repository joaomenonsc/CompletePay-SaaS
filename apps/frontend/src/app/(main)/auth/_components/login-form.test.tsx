import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/auth", () => ({
  login: vi.fn(),
  resendConfirmation: vi.fn(),
}));

const mockSetToken = vi.hoisted(() => vi.fn());
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (s: { token: string | null; setToken: (t: string) => void }) => unknown) =>
    selector({ token: null, setToken: mockSetToken }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const loginMock = vi.mocked(await import("@/lib/api/auth").then((m) => m.login));

describe("LoginForm", () => {
  it("renderiza campos de email e senha e botao Entrar", () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText(/voce@exemplo\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("nao chama login quando email e invalido (validacao bloqueia submit)", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByPlaceholderText(/voce@exemplo\.com/i), "invalido");
    await user.type(screen.getByPlaceholderText(/••••••••/), "12345678");
    await user.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(loginMock).not.toHaveBeenCalled();
    });
  });

  it("exibe erro de validacao para senha curta ao submeter", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByPlaceholderText(/voce@exemplo\.com/i), "a@b.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByText(/pelo menos 8/i)).toBeInTheDocument();
    });
  });

  it("chama login e redireciona quando credenciais validas", async () => {
    loginMock.mockResolvedValueOnce({
      access_token: "token-123",
      token_type: "bearer",
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByPlaceholderText(/voce@exemplo\.com/i), "user@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "password123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });
});
