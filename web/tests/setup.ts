import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

function nukeBody() {
  // AntD renders popovers/modals/messages into document.body via portals;
  // RTL's cleanup only unmounts the test container, so we purge leftover
  // portal nodes manually to avoid duplicate-element matches between tests.
  Array.from(document.body.children).forEach((el) => el.remove());
}

beforeEach(() => {
  nukeBody();
});
afterEach(() => {
  cleanup();
  nukeBody();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// jsdom doesn't implement matchMedia (required by AntD)
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
