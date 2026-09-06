import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardQuickDeduction from "./dashboard-quick-deduction";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardClassLinks />
    {children}
    <DashboardQuickDeduction />
  </>;
}
