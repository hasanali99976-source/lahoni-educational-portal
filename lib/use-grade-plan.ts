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

function planTime(plan: GradePlan | null) {
  if (!plan) return 0;
  return Date.parse(plan.activatedAt || plan.createdAt || "") || 0;
}

function newestGradePlan(localPlan: GradePlan | null, serverPlan: GradePlan | null) {
  if (!localPlan) return serverPlan;
  if (!serverPlan) return localPlan;
  if (serverPlan.id === localPlan.id) return serverPlan;
  if (serverPlan.version !== localPlan.version) return serverPlan.version > localPlan.version ? serverPlan : localPlan;
  return planTime(serverPlan) >= planTime(localPlan) ? serverPlan : localPlan;
}

function localPlanNeedsCloudSync(localPlan: GradePlan | null, serverPlan: GradePlan | null) {
  if (!localPlan) return false;
  if (!serverPlan) return true;
  if (localPlan.id === serverPlan.id) return false;
  if (localPlan.version !== serverPlan.version) return localPlan.version > serverPlan.version;
  return planTime(localPlan) > planTime(serverPlan);
}

async function syncLocalPlanToCloud(localPlan: GradePlan) {
  const response = await fetch("/api/teacher/grade-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ plan: localPlan }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return normalizeGradePlan(data.activePlan);
}

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
      let activePlan = newestGradePlan(localPlan, serverPlan);

      if (localPlanNeedsCloudSync(localPlan, serverPlan) && localPlan) {
        try {
          const syncedPlan = await syncLocalPlanToCloud(localPlan);
          if (syncedPlan) activePlan = syncedPlan;
        } catch (syncError) {
          console.warn("grade-plan-cloud-sync-v104", syncError);
        }
      }

      if (activePlan) saveLocalGradePlan(activePlan);
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
