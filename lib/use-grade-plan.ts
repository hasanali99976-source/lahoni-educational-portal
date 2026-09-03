"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeGradePlan, type GradePlan } from "./grade-plan";
import { readLocalGradePlan, saveLocalGradePlan } from "./grade-plan-local";

type GradePlanState = {
  activePlan: GradePlan | null;
  loading: boolean;
  error: string;
  history: Array<{ id: string; version: number; mode: string; method: string; status: string; activatedAt: string; archivedAt?: string }>;
};

export function useGradePlan(enabled = true) {
  const [state, setState] = useState<GradePlanState>(() => ({
    activePlan: enabled ? readLocalGradePlan() : null,
    loading: enabled,
    error: "",
    history: [],
  }));

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ activePlan: null, loading: false, error: "", history: [] });
      return null;
    }
    const localPlan = readLocalGradePlan();
    setState(current => ({ ...current, activePlan: current.activePlan || localPlan, loading: true, error: "" }));
    try {
      const response = await fetch("/api/teacher/grade-plan", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر تحميل خطة توزيع الدرجات.");
      const serverPlan = normalizeGradePlan(data.activePlan);
      const activePlan = serverPlan || localPlan;
      if (serverPlan) saveLocalGradePlan(serverPlan);
      setState({
        activePlan,
        loading: false,
        error: "",
        history: Array.isArray(data.history) ? data.history : [],
      });
      return activePlan;
    } catch (error) {
      const fallback = readLocalGradePlan();
      setState(current => ({
        ...current,
        activePlan: fallback || current.activePlan,
        loading: false,
        error: fallback ? "" : error instanceof Error ? error.message : "تعذر تحميل خطة توزيع الدرجات.",
      }));
      return fallback;
    }
  }, [enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { ...state, refresh };
}
