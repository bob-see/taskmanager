"use client";

import { useEffect, useState } from "react";

export function DelegatedListVisibility({ taskIds, children }: { taskIds: string[]; children: React.ReactNode }) {
  const [hiddenTaskIds, setHiddenTaskIds] = useState<string[]>([]);

  useEffect(() => {
    function handleVisibility(event: Event) {
      const detail = (event as CustomEvent<{ taskId: string; hidden: boolean }>).detail;
      if (!detail || !taskIds.includes(detail.taskId)) return;
      setHiddenTaskIds((current) => detail.hidden
        ? current.includes(detail.taskId) ? current : [...current, detail.taskId]
        : current.filter((id) => id !== detail.taskId));
    }
    window.addEventListener("delegated-task-visibility", handleVisibility);
    return () => window.removeEventListener("delegated-task-visibility", handleVisibility);
  }, [taskIds]);

  if (taskIds.length > 0 && hiddenTaskIds.length >= taskIds.length) return null;
  return <>{children}</>;
}
