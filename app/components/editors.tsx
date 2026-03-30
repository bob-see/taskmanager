"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from "react";

export type RepeatPattern = "daily" | "weekly" | "monthly";

export type RepeatFormState = {
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern;
  repeatDays: number;
  repeatWeeklyDay: number;
  repeatMonthlyDay: number;
};

export type EditTaskFormState = RepeatFormState & {
  title: string;
  startDate: string;
  dueAt: string;
  category: string;
  notes: string;
  projectId: string;
};

export type ProjectFormState = {
  name: string;
  startDate: string;
  dueAt: string;
  category: string;
};

type EditableTask = {
  title: string;
  startDate: string;
  dueAt: string | null;
  category: string | null;
  notes: string | null;
  projectId: string | null;
  repeatEnabled: boolean;
  repeatPattern: RepeatPattern | null;
  repeatDays: number | null;
  repeatWeeklyDay: number | null;
  repeatMonthlyDay: number | null;
};

type EditableProject = {
  name: string;
  startDate: string;
  dueAt: string | null;
  category: string | null;
};

type ProjectOption = {
  id: string;
  name: string;
  archived: boolean;
};

type TaskEditorModalProps = {
  open: boolean;
  form: EditTaskFormState | null;
  saving: boolean;
  categorySuggestions: string[];
  projectOptions: ProjectOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (updater: (prev: EditTaskFormState) => EditTaskFormState) => void;
};

type ProjectEditorModalProps = {
  open: boolean;
  form: ProjectFormState | null;
  saving: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (updater: (prev: ProjectFormState) => ProjectFormState) => void;
};

const DAY_TOGGLE_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const REPEAT_PATTERN_OPTIONS: Array<{ value: RepeatPattern; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const ALL_REPEAT_DAYS_MASK = 0b1111111;
const cardClass = "tm-card rounded-[12px] border shadow-sm";
const inputClass =
  "tm-input h-10 rounded-[10px] border px-3 text-sm outline-none transition-colors";
const buttonClass =
  "tm-button inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";
const primaryButtonClass =
  "tm-button-primary inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-sm";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(value: string | null) {
  return value ? dateInputValue(new Date(value)) : "";
}

function getWeekdayNumber(value: string) {
  const weekday = parseDateOnly(value).getDay();
  return weekday === 0 ? 7 : weekday;
}

function getDayOfMonth(value: string) {
  return parseDateOnly(value).getDate();
}

function getRepeatDayBit(weekday: number) {
  return 1 << (weekday - 1);
}

function DateInput(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} type="date" />;
}

function CategoryCombobox({
  value,
  suggestions,
  onChange,
  className,
  disabled = false,
  autoFocus = false,
  placeholder = "Category",
}: {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const filteredSuggestions = suggestions.filter((suggestion) =>
    suggestion.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          className={className}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (!open) {
              setOpen(true);
            }
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          aria-expanded={open}
          aria-label="Show category options"
          className="tm-button rounded-md border px-2 py-1 text-xs"
          disabled={disabled}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
        >
          ▾
        </button>
      </div>

      {open && filteredSuggestions.length > 0 && (
        <div className="tm-menu absolute left-0 right-0 top-full z-40 mt-1 max-h-52 min-w-full overflow-auto rounded-md border py-1 shadow-2xl">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/70"
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(suggestion);
                setOpen(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="tm-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`${cardClass} w-full max-w-lg p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className={buttonClass}
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RepeatFields<T extends RepeatFormState>({
  form,
  onChange,
  defaultDateValue,
}: {
  form: T;
  onChange: (updater: (prev: T) => T) => void;
  defaultDateValue: string;
}) {
  return (
    <div className={`${cardClass} space-y-3 p-3`}>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.repeatEnabled}
          onChange={(event) =>
            onChange((prev) => {
              const repeatWeeklyDay = getWeekdayNumber(defaultDateValue);

              return {
                ...prev,
                repeatEnabled: event.target.checked,
                repeatDays:
                  prev.repeatPattern === "weekly"
                    ? getRepeatDayBit(repeatWeeklyDay)
                    : ALL_REPEAT_DAYS_MASK,
                repeatWeeklyDay,
                repeatMonthlyDay: getDayOfMonth(defaultDateValue),
              };
            })
          }
        />
        <span>Repeat</span>
      </label>

      {form.repeatEnabled && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <div className="tm-muted">Pattern</div>
            <select
              className={`w-full ${inputClass}`}
              value={form.repeatPattern}
              onChange={(event) => {
                const repeatPattern = event.target.value as RepeatPattern;
                const repeatWeeklyDay = getWeekdayNumber(defaultDateValue);

                onChange((prev) => ({
                  ...prev,
                  repeatPattern,
                  repeatDays:
                    repeatPattern === "daily"
                      ? ALL_REPEAT_DAYS_MASK
                      : repeatPattern === "weekly"
                        ? getRepeatDayBit(repeatWeeklyDay)
                        : prev.repeatDays,
                  repeatWeeklyDay,
                  repeatMonthlyDay: getDayOfMonth(defaultDateValue),
                }));
              }}
            >
              {REPEAT_PATTERN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-black">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {(form.repeatPattern === "daily" || form.repeatPattern === "weekly") && (
            <div className="space-y-1 text-sm md:col-span-2">
              <div className="tm-muted">
                {form.repeatPattern === "daily" ? "Repeat days" : "Weekday"}
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_TOGGLE_LABELS.map((label, index) => {
                  const weekday = index + 1;
                  const bit = getRepeatDayBit(weekday);
                  const selected = (form.repeatDays & bit) !== 0;

                  return (
                    <button
                      key={`${label}-${weekday}`}
                      className={`h-9 w-9 rounded-full border text-sm ${
                        selected ? "tm-button-primary" : "tm-button"
                      }`}
                      type="button"
                      onClick={() =>
                        onChange((prev) => {
                          if (prev.repeatPattern === "weekly") {
                            return {
                              ...prev,
                              repeatDays: bit,
                              repeatWeeklyDay: weekday,
                            };
                          }

                          const nextRepeatDays = selected
                            ? prev.repeatDays & ~bit
                            : prev.repeatDays | bit;

                          if (nextRepeatDays === 0) {
                            return prev;
                          }

                          return {
                            ...prev,
                            repeatDays: nextRepeatDays,
                          };
                        })
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.repeatPattern === "monthly" && (
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Day of month</div>
              <select
                className={`w-full ${inputClass}`}
                value={form.repeatMonthlyDay}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    repeatMonthlyDay: Number(event.target.value),
                  }))
                }
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day} className="text-black">
                    {day}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function createEditTaskForm(task: EditableTask): EditTaskFormState {
  const startDate = toDateOnly(task.startDate) || todayInputValue();
  const repeatWeeklyDay = task.repeatWeeklyDay ?? getWeekdayNumber(startDate);

  return {
    title: task.title,
    startDate,
    dueAt: toDateOnly(task.dueAt),
    category: task.category ?? "",
    notes: task.notes ?? "",
    projectId: task.projectId ?? "",
    repeatEnabled: task.repeatEnabled,
    repeatPattern: task.repeatPattern ?? "daily",
    repeatDays:
      task.repeatDays ??
      (task.repeatPattern === "weekly"
        ? getRepeatDayBit(repeatWeeklyDay)
        : ALL_REPEAT_DAYS_MASK),
    repeatWeeklyDay,
    repeatMonthlyDay: task.repeatMonthlyDay ?? getDayOfMonth(startDate),
  };
}

export function createProjectForm(project?: EditableProject): ProjectFormState {
  return {
    name: project?.name ?? "",
    startDate: toDateOnly(project?.startDate ?? null) || todayInputValue(),
    dueAt: toDateOnly(project?.dueAt ?? null),
    category: project?.category ?? "",
  };
}

export function TaskEditorModal({
  open,
  form,
  saving,
  categorySuggestions,
  projectOptions,
  onClose,
  onSubmit,
  onFormChange,
}: TaskEditorModalProps) {
  return (
    <Modal open={open} title="Edit Task" onClose={onClose}>
      {form && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Task title"
            value={form.title}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, title: event.target.value }))
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Start date</div>
              <DateInput
                className={`w-full ${inputClass}`}
                required
                value={form.startDate}
                onChange={(event) =>
                  onFormChange((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Due date</div>
              <DateInput
                className={`w-full ${inputClass}`}
                value={form.dueAt}
                onChange={(event) =>
                  onFormChange((prev) => ({ ...prev, dueAt: event.target.value }))
                }
              />
            </label>
          </div>
          <CategoryCombobox
            className={`w-full ${inputClass}`}
            placeholder="Category"
            suggestions={categorySuggestions}
            value={form.category}
            onChange={(value) => onFormChange((prev) => ({ ...prev, category: value }))}
          />
          <textarea
            className={`min-h-28 w-full ${inputClass}`}
            placeholder="Notes"
            value={form.notes}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, notes: event.target.value }))
            }
          />
          <label className="space-y-1 text-sm">
            <div className="tm-muted">Project</div>
            <select
              className={`w-full ${inputClass}`}
              value={form.projectId}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, projectId: event.target.value }))
              }
            >
              <option value="" className="text-black">
                Unassigned
              </option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id} className="text-black">
                  {project.name}
                  {project.archived ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <RepeatFields
            form={form}
            defaultDateValue={form.startDate}
            onChange={(updater) => onFormChange((prev) => updater(prev))}
          />
          <button
            className={`${primaryButtonClass} px-4 disabled:opacity-50`}
            disabled={saving}
            type="submit"
          >
            Save Task
          </button>
        </form>
      )}
    </Modal>
  );
}

export function ProjectEditorModal({
  open,
  form,
  saving,
  title,
  submitLabel,
  onClose,
  onSubmit,
  onFormChange,
}: ProjectEditorModalProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {form && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Project name"
            value={form.name}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Start date</div>
              <DateInput
                className={`w-full ${inputClass}`}
                required
                value={form.startDate}
                onChange={(event) =>
                  onFormChange((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="tm-muted">Due date</div>
              <DateInput
                className={`w-full ${inputClass}`}
                value={form.dueAt}
                onChange={(event) =>
                  onFormChange((prev) => ({ ...prev, dueAt: event.target.value }))
                }
              />
            </label>
          </div>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Category"
            value={form.category}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, category: event.target.value }))
            }
          />
          <button
            className={`${primaryButtonClass} px-4 disabled:opacity-50`}
            disabled={saving}
            type="submit"
          >
            {submitLabel}
          </button>
        </form>
      )}
    </Modal>
  );
}
