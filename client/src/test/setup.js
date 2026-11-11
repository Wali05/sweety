import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  // Unmount first so nothing writes to storage after it has been cleared.
  cleanup();
  window.localStorage.clear();
});
