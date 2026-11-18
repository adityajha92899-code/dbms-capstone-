# FleetFlow TMS — Design System

## Color Tokens (`tailwind.config.js`)

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `obsidian-900` | `#0F172A` | Sidebar background, dark login hero |
| `obsidian-800` | `#1E293B` | Hover states on dark surfaces |
| `accent` | `#F59E0B` | Primary CTA buttons, active nav border, live markers |
| `accent-hover` | `#D97706` | Button hover state |
| `status-success` | `#10B981` | Delivered, active, completed badges |
| `status-warning` | `#F59E0B` | In-progress, maintenance, in-transit badges |
| `status-danger` | `#EF4444` | Suspended, error banners, destructive actions |
| `status-info` | `#3B82F6` | Scheduled, confirmed badges |
| `surface` | `#F8FAFC` | App canvas background |
| `surface-card` | `#FFFFFF` | Card & table surfaces |

## Typography

- **UI Sans:** `Inter, system-ui, sans-serif`
- **Monospace (KPIs, IDs, Reg#):** `JetBrains Mono, monospace`

## Component Inventory

- **Primitives (`components/ui/`):** `Button`, `Dialog`, `DropdownMenu`
- **Layout (`components/layout/`):** `AppShell`, `Sidebar` (collapsible 72px/260px), `Topbar` (⌘K Search + Bell Notifications + Avatar)
- **Shared (`components/shared/`):** `KpiCard`, `DataTable`, `StatusBadge`, `EmptyState`, `SkeletonLoader`, `ConfirmDialog`, `PageHeader`, `LiveMap`
