import { PageHeader } from '../components/PageHeader';

const MGT_ITEMS: {
  id: string;
  task: string;
  status: 'done' | 'product' | 'owner';
  owner: string;
  note?: string;
}[] = [
  { id: 'MGT-001', task: 'Google Cloud project + billing', status: 'owner', owner: 'IT' },
  { id: 'MGT-002', task: 'Enable Maps / Geocoding APIs', status: 'owner', owner: 'IT' },
  { id: 'MGT-003', task: 'Create and restrict API keys', status: 'owner', owner: 'IT' },
  {
    id: 'MGT-004',
    task: 'Privacy policy (location)',
    status: 'owner',
    owner: 'Legal',
    note: 'Template: docs/compliance/privacy-policy-template.md',
  },
  { id: 'MGT-005', task: 'Staff consent / tracking policy', status: 'owner', owner: 'Legal/HR' },
  {
    id: 'MGT-006',
    task: 'Define subscription plans',
    status: 'product',
    owner: 'Product',
    note: 'docs/MGT-COMMERCIAL-PLANS.md',
  },
  { id: 'MGT-007', task: 'ScaleGate license API docs', status: 'owner', owner: 'ScaleGate' },
  {
    id: 'MGT-008',
    task: 'Map plan codes to features',
    status: 'done',
    owner: 'Product',
    note: 'shared/entitlements.ts + docs/MGT-PLAN-MAPPING.md',
  },
  { id: 'MGT-009', task: 'Customer onboarding flow', status: 'owner', owner: 'Ops' },
  {
    id: 'MGT-010',
    task: 'Terms of Service + DPA',
    status: 'owner',
    owner: 'Legal',
    note: 'docs/compliance/',
  },
  { id: 'MGT-011', task: 'ERP priority order', status: 'owner', owner: 'Product' },
  { id: 'MGT-012', task: 'SAGE sandbox/SDK', status: 'owner', owner: 'Vendor' },
  { id: 'MGT-013', task: 'SAP B1 sandbox', status: 'owner', owner: 'IT' },
  { id: 'MGT-014', task: 'QuickBooks developer + OAuth', status: 'owner', owner: 'IT' },
  { id: 'MGT-015', task: 'Tally SDK/docs', status: 'owner', owner: 'Vendor' },
  { id: 'MGT-015b', task: 'Pilot customer for ERP', status: 'owner', owner: 'Product' },
  { id: 'MGT-016', task: 'Google Play Developer account', status: 'owner', owner: 'Product' },
  { id: 'MGT-017', task: 'Apple Developer Program', status: 'owner', owner: 'Product' },
  { id: 'MGT-018', task: 'Store listings', status: 'owner', owner: 'Marketing' },
  { id: 'MGT-019', task: 'Play Data safety + rating', status: 'owner', owner: 'Legal' },
  {
    id: 'MGT-020',
    task: 'SaaS domain and DNS',
    status: 'done',
    owner: 'IT',
    note: 'app.wizcrm.app + api.wizcrm.app live',
  },
  {
    id: 'MGT-021',
    task: 'Support email / status page',
    status: 'product',
    owner: 'Ops',
    note: 'Support email in Branding settings',
  },
  {
    id: 'MGT-022',
    task: 'Default geofence radius',
    status: 'done',
    owner: 'Product',
    note: 'CRM lists → check-in radius (meters)',
  },
  {
    id: 'MGT-023',
    task: 'Meeting grace + attendance rules',
    status: 'done',
    owner: 'Product',
    note: 'CRM lists → meeting grace minutes',
  },
];

const STATUS_LABEL = {
  done: '✅ Done',
  product: '🟡 In product — owner sign-off',
  owner: '⬜ Owner action',
};

export function BusinessPage() {
  const done = MGT_ITEMS.filter((i) => i.status === 'done').length;
  const product = MGT_ITEMS.filter((i) => i.status === 'product').length;
  const owner = MGT_ITEMS.filter((i) => i.status === 'owner').length;

  return (
    <div className="page-wide">
      <PageHeader
        title="Business & compliance"
        subtitle="MGT checklist — engineering complete where marked done; remaining items need Product, Legal, or IT."
      />
      <p className="muted">
        {done} done · {product} in product · {owner} awaiting owner
      </p>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Task</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {MGT_ITEMS.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.task}</td>
                <td>{STATUS_LABEL[row.status]}</td>
                <td>{row.owner}</td>
                <td className="muted">{row.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
