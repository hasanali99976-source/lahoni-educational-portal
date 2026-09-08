"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PortalVoiceGreeting from "../lib/portal-voice-greeting";

type GreetingIdentity = {
  role: "teacher" | "student";
  name: string;
  identityKey: string;
};

function textOf(selector: string) {
  return String(document.querySelector(selector)?.textContent || "").trim();
}

function detectIdentity(pathname: string): GreetingIdentity | null {
  if (pathname.startsWith("/teacher") && document.querySelector(".teacher-academy-v12")) {
    const name = textOf(".academy-v12-profile-copy h2");
    const safeName = name && name !== "المعلم" ? name : "";
    return { role: "teacher", name: safeName, identityKey: `teacher:${safeName || "active"}` };
  }

  if (pathname.startsWith("/student") && document.querySelector(".student-academy-v4") && !document.querySelector(".student-gateway-v4")) {
    const name = textOf(".sta4-id strong") || textOf(".sta4-student strong");
    const code = textOf(".sta4-id code");
    const safeName = name && name !== "الطالب" ? name : "";
    return { role: "student", name: safeName, identityKey: `student:${code || safeName || "active"}` };
  }

  return null;
}

export default function PortalVoiceGreetingRuntime() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState<GreetingIdentity | null>(null);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setIdentity(detectIdentity(pathname)));
    };

    update();
    timeout = window.setTimeout(update, 700);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("pageshow", update);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("pageshow", update);
      setIdentity(null);
    };
  }, [pathname]);

  if (!identity) return null;
  return <PortalVoiceGreeting role={identity.role} name={identity.name} identityKey={identity.identityKey} compact />;
}
