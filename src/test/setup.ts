import '@testing-library/jest-dom';

// jsdom does not implement crypto.randomUUID – polyfill it
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => Math.random().toString(36).slice(2) + Date.now().toString(36),
    },
  });
}

// Silence console.error in tests (store DB saves will fail, that's expected)
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
