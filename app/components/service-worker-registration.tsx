"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .getRegistration("/")
      .then((existingRegistration) => {
        if (cancelled || existingRegistration) return existingRegistration;
        return navigator.serviceWorker.register("/sw.js", { scope: "/" });
      })
      .catch((error) => {
        console.warn("TaskManager service worker registration failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
