/**
 * Barrel re-export for all shared dashboard components.
 *
 * Usage in route files:
 * ```ts
 * import { MetricCard, PageHeader, SortDropdown, ... } from "~/components/dashboard/layout/DashboardPageLayout";
 * ```
 */

// ── Constants ──────────────────────────────────────────────────────────────
export { CARD_GRADIENTS } from "~/components/dashboard/constants/dashboard.constants";

// ── Shared components ──────────────────────────────────────────────────────
export { MetricCard } from "~/components/dashboard/shared/MetricCard";
export { StatusBadge } from "~/components/dashboard/shared/StatusBadge";
export { GradientThumbnail } from "~/components/dashboard/shared/GradientThumbnail";
export { QuickActionCard } from "~/components/dashboard/shared/QuickActionCard";
export { FormActions } from "~/components/dashboard/shared/FormActions";
export { FilterTabs } from "~/components/dashboard/shared/FilterTabs";
export { CardOverflowMenu } from "~/components/dashboard/shared/CardOverflowMenu";
export { PageHeader } from "~/components/dashboard/shared/PageHeader";
export { SectionHeader } from "~/components/dashboard/shared/SectionHeader";
export { ProgressRing } from "~/components/dashboard/shared/ProgressRing";
export { SortDropdown } from "~/components/dashboard/shared/SortDropdown";
export { ViewToggle } from "~/components/dashboard/shared/ViewToggle";

// ── Layout utilities ───────────────────────────────────────────────────────
export {
  GradientPlaceholder,
  FilterButton,
  StatusDotBadge,
} from "~/components/dashboard/layout/DashboardLayout";
