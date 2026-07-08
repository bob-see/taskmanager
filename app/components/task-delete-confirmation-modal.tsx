type DeleteTaskMode = "this" | "future" | "series";

type TaskDeleteConfirmationModalProps = {
  open: boolean;
  taskTitle: string;
  recurring?: boolean;
  mode: DeleteTaskMode;
  saving?: boolean;
  modeName: string;
  onModeChange: (mode: DeleteTaskMode) => void;
  onCancel: () => void;
  onConfirm: (mode: DeleteTaskMode) => void;
};

const choiceClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--tm-border)] bg-white/45 p-3 text-sm transition-colors hover:border-amber-700/20 hover:bg-white/70";

export function TaskDeleteConfirmationModal({
  open,
  taskTitle,
  recurring = false,
  mode,
  saving = false,
  modeName,
  onModeChange,
  onCancel,
  onConfirm,
}: TaskDeleteConfirmationModalProps) {
  if (!open) return null;

  function cancel() {
    if (saving) return;
    onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      onClick={cancel}
    >
      <div
        className="tm-card w-full max-w-lg overflow-hidden rounded-[14px] border-2 border-black/10 p-0 shadow-[0_22px_60px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b-2 border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(245,226,190,0.34))] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-amber-800/20 bg-amber-50/80 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-700/70" />
                Confirm delete
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Delete task?</h3>
            </div>
            <div className="hidden rounded-md border border-black/10 bg-white/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--tm-muted)] sm:block">
              TASK//DEL
            </div>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(mode);
          }}
        >
          <div className="space-y-4 p-4 md:p-5">
            <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
                Selected task
              </div>
              <div className="text-sm font-semibold leading-5 text-[color:var(--tm-text)]">
                {taskTitle}
              </div>
            </div>

            {recurring && (
              <div className="space-y-2">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
                  Recurring delete scope
                </div>
                <label className={choiceClass}>
                  <input
                    checked={mode === "this"}
                    disabled={saving}
                    name={modeName}
                    type="radio"
                    value="this"
                    onChange={() => onModeChange("this")}
                  />
                  <div>
                    <div className="font-medium">This task only</div>
                  </div>
                </label>
                <label className={choiceClass}>
                  <input
                    checked={mode === "future"}
                    disabled={saving}
                    name={modeName}
                    type="radio"
                    value="future"
                    onChange={() => onModeChange("future")}
                  />
                  <div>
                    <div className="font-medium">This and future tasks</div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/50 bg-red-50/80 p-3 text-sm transition-colors hover:bg-red-100/70">
                  <input
                    checked={mode === "series"}
                    disabled={saving}
                    name={modeName}
                    type="radio"
                    value="series"
                    onChange={() => onModeChange("series")}
                  />
                  <div>
                    <div className="font-medium text-red-700">Entire series</div>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[color:var(--tm-border)] bg-white/25 px-4 py-3 sm:flex-row sm:justify-end md:px-5">
            <button
              className="tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm"
              disabled={saving}
              type="button"
              onClick={cancel}
            >
              Cancel
            </button>
            <button
              className="tm-button-danger inline-flex h-10 items-center justify-center rounded-[10px] border px-4 text-sm font-semibold shadow-[0_2px_8px_rgba(185,28,28,0.08)] disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
