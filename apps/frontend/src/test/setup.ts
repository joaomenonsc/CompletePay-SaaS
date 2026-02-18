import "@testing-library/jest-dom";

// jsdom nao tem ResizeObserver (usado por Radix/Base UI)
class ResizeObserverMock {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Garante localStorage com setItem/getItem/removeItem para zustand persist (jsdom pode falhar em alguns ambientes)
const store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  key: () => null,
  get length() {
    return Object.keys(store).length;
  },
};
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.setItem !== "function") {
  globalThis.localStorage = mockStorage;
}
