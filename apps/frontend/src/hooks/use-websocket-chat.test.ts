import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWebSocketChat } from "@/hooks/use-websocket-chat";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, _reason?: string) {
    this.readyState = 2; // CLOSED
    this.onclose?.({ code: code ?? 1000 });
  }

  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(code = 1000) {
    this.readyState = 2;
    this.onclose?.({ code });
  }
}

vi.mock("@/store/auth-store", () => ({
  useAuthStore: {
    getState: () => ({ token: "fake-jwt-token" }),
  },
}));

describe("useWebSocketChat", () => {
  const wsOptions = {
    sessionId: "test-session",
    wsConstructor: MockWebSocket as unknown as typeof WebSocket,
  };

  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve conectar com token no URL", async () => {
    renderHook(() => useWebSocketChat(wsOptions));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    expect(MockWebSocket.instances[0].url).toContain("token=fake-jwt-token");
  });

  it("deve ter mensagem inicial", () => {
    const { result } = renderHook(() => useWebSocketChat(wsOptions));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });

  it("deve atualizar status para connected no open", async () => {
    const { result } = renderHook(() => useWebSocketChat(wsOptions));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe("connected");
  });

  it("deve processar streaming de tokens", async () => {
    const { result } = renderHook(() => useWebSocketChat(wsOptions));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    const ws = MockWebSocket.instances[0];

    act(() => ws.simulateOpen());

    act(() => result.current.sendMessage("Olá"));

    act(() => ws.simulateMessage({ type: "stream_start" }));
    act(() => ws.simulateMessage({ type: "token", content: "Olá, " }));
    act(() => ws.simulateMessage({ type: "token", content: "como " }));
    act(() =>
      ws.simulateMessage({ type: "token", content: "posso ajudar?" }),
    );
    act(() =>
      ws.simulateMessage({
        type: "stream_end",
        content: "Olá, como posso ajudar?",
      }),
    );

    const msgs = result.current.messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[2].content).toBe("Olá, como posso ajudar?");
    expect(msgs[2].isStreaming).toBe(false);
  });

  it("deve resetar chat", () => {
    const { result } = renderHook(() => useWebSocketChat(wsOptions));

    act(() => result.current.resetChat());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });
});
