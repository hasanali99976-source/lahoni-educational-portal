import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import DiagnosticsExportEnhancer from "./diagnostics-export-enhancer";
import DiagnosticsPrintEnhancer from "./diagnostics-print-enhancer";

export default function DiagnosticsLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><DiagnosticsExportEnhancer /><DiagnosticsPrintEnhancer />{children}</>;
}
