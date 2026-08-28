"use client";

import { useEffect } from "react";

export default function TeacherNativeLogout() {
  useEffect(() => {
    const restoreNativeLogout = () => {
      document.querySelectorAll<HTMLElement>(".teacher-logout").forEach(button => {
        button.removeAttribute("data-portal-command");
        button.removeAttribute("data-portal-icon");
        button.setAttribute("data-native-teacher-logout", "true");
      });
    };

    restoreNativeLogout();
    const observer = new MutationObserver(restoreNativeLogout);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
