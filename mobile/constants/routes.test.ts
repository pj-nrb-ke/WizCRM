import { describe, expect, it } from 'vitest';
import { MANAGER_TAB_ROUTES, REP_TAB_ROUTES } from './routes';

describe('UT-LITE-014 mobile shell routes', () => {
  it('rep tabs are desk, leads, pipeline', () => {
    expect(REP_TAB_ROUTES).toEqual(['desk', 'leads', 'pipeline']);
  });

  it('manager adds team tab', () => {
    expect(MANAGER_TAB_ROUTES).toContain('team');
    expect(MANAGER_TAB_ROUTES.length).toBe(4);
  });
});
