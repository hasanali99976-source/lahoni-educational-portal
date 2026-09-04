"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

const ENTRY_ROUTES = new Set(["/", "/admin", "/teacher", "/student", "/parent"]);

export default function PortalRuntimeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (ENTRY_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
