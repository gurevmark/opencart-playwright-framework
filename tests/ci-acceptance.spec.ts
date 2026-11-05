import { expect, test } from '@playwright/test';

// Temporary acceptance probe, removed after verifying the required PR check.
test('Controlled CI acceptance failure @master', () => {
  expect('controlled failure').toBe('passing result');
});
