"use client";

import { useEffect } from "react";

export function ProfileTaskBadgeSeenMarker({ profileId }: { profileId: string }) {
  useEffect(() => {
    void fetch(`/api/p/${encodeURIComponent(profileId)}/tasks/seen`, {
      method: "POST",
      keepalive: true,
    }).then((response) => {
      if (response.ok) {
        window.dispatchEvent(
          new CustomEvent("profile-task-badge-seen", { detail: { profileId } })
        );
      }
    }).catch(() => {
      // The badge will remain until the next successful visit.
    });
  }, [profileId]);

  return null;
}
