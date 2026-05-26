# Plan code → feature mapping (MGT-008)

Implemented in `shared/src/entitlements.ts` via `resolveEntitlements(settings)`.

| Setting | Lite | Pro | Enterprise |
|---------|:----:|:---:|:----------:|
| `plan` | `lite` | `pro` | `enterprise` |
| `leadInsights` | — | ✓ | ✓ |
| `communicationDrafts` | — | ✓ | ✓ |
| `targetsPacing` | — | ✓ | ✓ |
| `dataHygiene` | — | ✓ | ✓ |
| `quotations` | — | ✓ | ✓ |
| `advancedReports` | — | ✓ | ✓ |
| `webhook` | opt-in | ✓ | ✓ |
| `geofence` | — | ✓ | ✓ |
| `erpSync` | — | ✓ (stub) | ✓ |

Admins set plan on **Platform → AI & platform** until ScaleGate (PRO-015) is wired.
