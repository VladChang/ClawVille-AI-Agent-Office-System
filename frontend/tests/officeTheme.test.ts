import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOfficePortraitAsset, resolveOfficeTheme } from '../lib/officeTheme';

test('office theme supports overriding background image without changing map logic', () => {
  const originalBackground = process.env.NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE;
  process.env.NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE = '/office/custom-theme.svg';

  try {
    const theme = resolveOfficeTheme('studio');
    assert.equal(theme.map.backgroundImage, '/office/custom-theme.svg');
    assert.equal(theme.map.walkableAreas.length > 0, true);
    assert.equal(theme.map.obstacles.length > 0, true);
  } finally {
    if (originalBackground === undefined) delete process.env.NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE;
    else process.env.NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE = originalBackground;
  }
});

test('office theme resolves portrait assets by role and offline fallback', () => {
  const theme = resolveOfficeTheme('studio');

  assert.equal(resolveOfficePortraitAsset({ role: 'Planner', status: 'busy' }, theme).id, 'planner');
  assert.equal(resolveOfficePortraitAsset({ role: 'QA Reviewer', status: 'busy' }, theme).id, 'reviewer');
  assert.equal(resolveOfficePortraitAsset({ role: 'Anything', status: 'offline' }, theme).id, 'responder');
});
