import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import DiagnosticsExportEnhancer from "./diagnostics-export-enhancer";

export default function DiagnosticsLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><DiagnosticsExportEnhancer />{children}</>;
}
