/** Main rep shell tabs (UT-LITE-014). */
export const REP_TAB_ROUTES = ['desk', 'leads', 'pipeline'] as const;

export const MANAGER_TAB_ROUTES = [...REP_TAB_ROUTES, 'team'] as const;

export type RepTabRoute = (typeof REP_TAB_ROUTES)[number];
