"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DelegateTaskModal } from "./delegate-task-modal";

export function NewDelegatedTaskButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm"
        onClick={() => setOpen(true)}
      >
        New Delegated Task
      </button>
      <DelegateTaskModal
        open={open}
        mode={{ mode: "new" }}
        onClose={() => setOpen(false)}
        onDelegated={() => router.refresh()}
      />
    </>
  );
}
