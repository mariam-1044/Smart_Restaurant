import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('axios.get unmocked'))),
    post: vi.fn(() => Promise.reject(new Error('axios.post unmocked'))),
    patch: vi.fn(() => Promise.reject(new Error('axios.patch unmocked'))),
    put: vi.fn(() => Promise.reject(new Error('axios.put unmocked'))),
    delete: vi.fn(() => Promise.reject(new Error('axios.delete unmocked'))),
    request: vi.fn(() => Promise.reject(new Error('axios.request unmocked')))
  }
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});