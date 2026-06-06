"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SpaceSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type MatrixRow = {
  id: string;
  spaceId: string;
  name: string;
  order: number;
  isDone: boolean;
  doneAt: string | null;
  cellTypeOverride: RowCellTypeOverride | null;
  isPending?: boolean;
};

type StatusOption = {
  id: string;
  columnId: string;
  label: string;
  color: string;
  order: number;
};

type MatrixColumn = {
  id: string;
  spaceId: string;
  name: string;
  type: ColumnType;
  order: number;
  statusOptions: StatusOption[];
  isPending?: boolean;
};

type MatrixCell = {
  id: string;
  rowId: string;
  columnId: string;
  textValue: string | null;
  numberValue: string | number | null;
  dateValue: string | null;
  booleanValue: boolean | null;
  statusOptionId: string | null;
  userIdValue: string | null;
  notes: string | null;
  noteHistory: MatrixCellNote[];
  updatedAt: string;
  isPending?: boolean;
};

type MatrixCellNote = {
  id: string;
  cellId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  isPending?: boolean;
};

type SpaceDetail = SpaceSummary & {
  rows: MatrixRow[];
  columns: MatrixColumn[];
  cells: MatrixCell[];
  currentMember: {
    id: string;
    role: string;
  };
};

type SpaceMember = {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ColumnType = "status" | "text" | "number" | "date" | "checkbox" | "user";
type RowCellTypeOverride = "status" | "date" | "text" | "number" | "checkbox";
type EffectiveCellType = ColumnType | RowCellTypeOverride;

type MenuAnchor = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type MatrixActionMenuState = {
  kind: "row" | "column";
  id: string;
  anchor: MenuAnchor;
};

type FloatingMenuItem = {
  label: string;
  helper?: string;
  disabled?: boolean;
  active?: boolean;
  kind?: "item" | "section";
  onSelect: () => void;
};

const columnTypes: ColumnType[] = [
  "status",
  "text",
  "number",
  "date",
  "checkbox",
  "user",
];
const rowCellTypeOverrideOptions: { label: string; value: RowCellTypeOverride | null }[] = [
  { label: "Inherit from columns", value: null },
  { label: "Status", value: "status" },
  { label: "Date", value: "date" },
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "Checkbox", value: "checkbox" },
];

const statusColorClasses: Record<string, string> = {
  red: "border-red-500 bg-red-200 text-red-950",
  neutral: "border-slate-500 bg-slate-300 text-slate-950",
  muted: "border-slate-500 bg-slate-300 text-slate-950",
  gray: "border-slate-500 bg-slate-300 text-slate-950",
  grey: "border-slate-500 bg-slate-300 text-slate-950",
  amber: "border-amber-500 bg-amber-200 text-amber-950",
  yellow: "border-amber-500 bg-amber-200 text-amber-950",
  blue: "border-blue-500 bg-blue-200 text-blue-950",
  green: "border-green-600 bg-green-200 text-green-950",
  purple: "border-purple-500 bg-purple-200 text-purple-950",
};

const statusColorOptions = ["red", "amber", "blue", "green", "purple", "neutral"];
const neutralStatusClasses = "border-slate-500 bg-slate-300 text-slate-950";

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatCellTypeLabel(type: RowCellTypeOverride) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatCompactDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, day));
}

function effectiveCellType(row: MatrixRow, column: MatrixColumn): EffectiveCellType {
  return row.cellTypeOverride || column.type;
}

function statusColumnForCell(
  row: MatrixRow,
  column: MatrixColumn,
  columns: MatrixColumn[]
) {
  if (effectiveCellType(row, column) !== "status") return null;
  return column.type === "status"
    ? column
    : columns.find((item) => item.type === "status") ?? null;
}

function cellDisplayValue(cell: MatrixCell | undefined, type: EffectiveCellType) {
  if (!cell) return "";
  if (type === "text") return cell.textValue ?? "";
  if (type === "number") return cell.numberValue?.toString() ?? "";
  if (type === "date") return toDateInputValue(cell.dateValue);
  if (type === "checkbox") return cell.booleanValue ?? false;
  if (type === "user") return cell.userIdValue ?? "";
  return cell.statusOptionId ?? "";
}

function createTempId(prefix: string) {
  return `temp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function DiscardChangesModal({
  open,
  onKeepEditing,
  onDiscardChanges,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscardChanges: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4">
      <div className="tm-card w-full max-w-sm rounded-xl border p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Discard unsaved changes?</h2>
        <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
          You have unsaved changes. If you leave now, they will be lost.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            type="button"
            onClick={onKeepEditing}
          >
            Keep Editing
          </button>
          <button
            className="tm-button-primary min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            type="button"
            onClick={onDiscardChanges}
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function getNextOrder(items: { order: number }[]) {
  return Math.max(-1, ...items.map((item) => item.order)) + 1;
}

function createOptimisticCell(
  rowId: string,
  columnId: string,
  type: EffectiveCellType,
  value: string | number | boolean | null,
  previousCell?: MatrixCell
): MatrixCell {
  const cell: MatrixCell = previousCell
    ? { ...previousCell, updatedAt: new Date().toISOString(), isPending: true }
    : {
        id: createTempId("cell"),
        rowId,
        columnId,
        textValue: null,
        numberValue: null,
        dateValue: null,
        booleanValue: null,
        statusOptionId: null,
        userIdValue: null,
        notes: null,
        noteHistory: [],
        updatedAt: new Date().toISOString(),
        isPending: true,
      };

  if (type === "text") {
    return { ...cell, textValue: value === null || value === "" ? null : String(value) };
  }
  if (type === "number") {
    return { ...cell, numberValue: value === null || value === "" ? null : Number(value) };
  }
  if (type === "date") {
    return { ...cell, dateValue: value === null || value === "" ? null : String(value) };
  }
  if (type === "checkbox") {
    return { ...cell, booleanValue: Boolean(value) };
  }
  if (type === "user") {
    return { ...cell, userIdValue: value === null || value === "" ? null : String(value) };
  }
  return { ...cell, statusOptionId: value === null || value === "" ? null : String(value) };
}

function replaceCell(
  cells: MatrixCell[],
  rowId: string,
  columnId: string,
  nextCell: MatrixCell | null
) {
  const remainingCells = cells.filter(
    (cell) => !(cell.rowId === rowId && cell.columnId === columnId)
  );
  return nextCell ? [...remainingCells, nextCell] : remainingCells;
}

function inputClassName(extra = "") {
  return [
    "tm-input min-h-9 rounded-[10px] border px-3 py-1.5 text-sm outline-none",
    "focus:border-slate-300 focus:ring-2 focus:ring-slate-200",
    extra,
  ].join(" ");
}

function statusPillClassName(color: string | null | undefined) {
  const colorKey = typeof color === "string" ? color.trim().toLowerCase() : "";
  return [
    "min-h-8 w-full rounded-full border px-2.5 py-1 text-left text-sm font-medium outline-none transition",
    "focus:ring-2 focus:ring-slate-200 disabled:opacity-70",
    statusColorClasses[colorKey] ?? neutralStatusClasses,
  ].join(" ");
}

function statusIndicatorClassName(color: string | null | undefined) {
  const colorKey = typeof color === "string" ? color.trim().toLowerCase() : "";
  return [
    "h-5 w-10 rounded-full border shadow-sm",
    statusColorClasses[colorKey] ?? neutralStatusClasses,
  ].join(" ");
}

function statusDotClassName(color: string | null | undefined) {
  const colorKey = typeof color === "string" ? color.trim().toLowerCase() : "";
  return [
    "h-2.5 w-2.5 rounded-full border shadow-sm",
    statusColorClasses[colorKey] ?? neutralStatusClasses,
  ].join(" ");
}

function statusLabel(option: StatusOption | undefined) {
  return option ? `Status: ${option.label}` : "Select status";
}

function columnWidthClassName(type: ColumnType) {
  if (type === "checkbox") return "w-[110px] min-w-[110px] max-w-[110px]";
  if (type === "number") return "w-[90px] min-w-[90px] max-w-[110px]";
  if (type === "status") return "w-[120px] min-w-[120px] max-w-[140px]";
  if (type === "date") return "w-[150px] min-w-[150px] max-w-[170px]";
  if (type === "user") return "w-[120px] min-w-[120px] max-w-[150px]";
  return "w-[160px] min-w-[140px] max-w-[220px]";
}

function cellWidthClassName(column: MatrixColumn, type: EffectiveCellType) {
  if (type === "date" && column.type !== "date") {
    return "w-[132px] min-w-[132px] max-w-[132px]";
  }
  return columnWidthClassName(column.type);
}

function sortColumns(columns: MatrixColumn[]) {
  return [...columns].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function sortRows(rows: MatrixRow[]) {
  return [...rows].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function getMenuAnchor(element: HTMLElement): MenuAnchor {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
  };
}

function memberDisplayName(member: SpaceMember | undefined) {
  if (!member) return "";
  return member.user.name || member.user.email || member.userId;
}

function memberInitials(member: SpaceMember | undefined) {
  const label = memberDisplayName(member);
  if (!label) return "?";
  const parts = label
    .replace(/@.*/, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function createBlankCell(rowId: string, columnId: string): MatrixCell {
  return {
    id: createTempId("cell"),
    rowId,
    columnId,
    textValue: null,
    numberValue: null,
    dateValue: null,
    booleanValue: null,
    statusOptionId: null,
    userIdValue: null,
    notes: null,
    noteHistory: [],
    updatedAt: new Date().toISOString(),
    isPending: true,
  };
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  const dayMonth = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${dayMonth} • ${time}`;
}

export function SpacesClient() {
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingSpace, setLoadingSpace] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [deleteSpaceOpen, setDeleteSpaceOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedMemberUserId, setSelectedMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "owner">("member");
  const [rowName, setRowName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("text");
  const [showDoneRows, setShowDoneRows] = useState(false);
  const [activeCell, setActiveCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [configuringColumnId, setConfiguringColumnId] = useState<string | null>(null);
  const [matrixActionMenu, setMatrixActionMenu] =
    useState<MatrixActionMenuState | null>(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const rowNameInputRef = useRef<HTMLInputElement | null>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    for (const cell of space?.cells ?? []) {
      map.set(`${cell.rowId}:${cell.columnId}`, cell);
    }
    return map;
  }, [space?.cells]);
  const memberMap = useMemo(() => {
    const map = new Map<string, SpaceMember>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);
  const activeRow = space?.rows.find((row) => row.id === activeCell?.rowId);
  const activeColumn = space?.columns.find(
    (column) => column.id === activeCell?.columnId
  );
  const configuringColumn = space?.columns.find(
    (column) => column.id === configuringColumnId
  );
  const activeMatrixCell =
    activeCell && activeColumn
      ? cellMap.get(`${activeCell.rowId}:${activeColumn.id}`)
      : undefined;
  const canManageMembers = space?.currentMember.role === "owner";
  const currentSpaceMember = members.find(
    (member) => member.id === space?.currentMember.id
  );
  const selectedUserIsMember = members.some(
    (member) => member.userId === selectedMemberUserId
  );
  const orderedColumns = useMemo(
    () => sortColumns(space?.columns ?? []),
    [space?.columns]
  );
  const orderedRows = useMemo(() => {
    const rows = sortRows(space?.rows ?? []);
    const activeRows = rows.filter((row) => !row.isDone);
    const doneRows = rows.filter((row) => row.isDone);
    return showDoneRows ? [...activeRows, ...doneRows] : activeRows;
  }, [space?.rows, showDoneRows]);
  const hiddenDoneRowCount = useMemo(
    () => (space?.rows ?? []).filter((row) => row.isDone).length,
    [space?.rows]
  );
  const activeMenuColumn =
    matrixActionMenu?.kind === "column"
      ? orderedColumns.find((column) => column.id === matrixActionMenu.id)
      : undefined;
  const activeMenuColumnIndex = activeMenuColumn
    ? orderedColumns.findIndex((column) => column.id === activeMenuColumn.id)
    : -1;
  const activeMenuRow =
    matrixActionMenu?.kind === "row"
      ? orderedRows.find((row) => row.id === matrixActionMenu.id)
      : undefined;
  const activeMenuRowGroup = activeMenuRow
    ? orderedRows.filter((row) => row.isDone === activeMenuRow.isDone)
    : [];
  const activeMenuRowIndex = activeMenuRow
    ? activeMenuRowGroup.findIndex((row) => row.id === activeMenuRow.id)
    : -1;
  const matrixMenuItems: FloatingMenuItem[] = activeMenuColumn
    ? [
        {
          label: "Move left",
          disabled:
            activeMenuColumnIndex === 0 ||
            saving === `column-order:${activeMenuColumn.id}`,
          onSelect: () => moveColumn(activeMenuColumn, "left"),
        },
        {
          label: "Move right",
          disabled:
            activeMenuColumnIndex === orderedColumns.length - 1 ||
            saving === `column-order:${activeMenuColumn.id}`,
          onSelect: () => moveColumn(activeMenuColumn, "right"),
        },
        {
          label: "Rename column",
          onSelect: () => setConfiguringColumnId(activeMenuColumn.id),
        },
        ...(activeMenuColumn.type === "status"
          ? [
              {
                label: "Status legend/options",
                onSelect: () => setConfiguringColumnId(activeMenuColumn.id),
              },
            ]
          : []),
      ]
    : activeMenuRow
      ? [
          {
            label: "Rename row",
            onSelect: () => renameRow(activeMenuRow),
          },
          {
            label: "Move up",
            disabled:
              activeMenuRowIndex === 0 ||
              saving === `row-order:${activeMenuRow.id}`,
            onSelect: () => moveRow(activeMenuRow, "up"),
          },
          {
            label: "Move down",
            disabled:
              activeMenuRowIndex === activeMenuRowGroup.length - 1 ||
              saving === `row-order:${activeMenuRow.id}`,
            onSelect: () => moveRow(activeMenuRow, "down"),
          },
          {
            label: activeMenuRow.isDone ? "Mark active" : "Mark done",
            disabled: saving === `row:${activeMenuRow.id}`,
            onSelect: () => toggleRowDone(activeMenuRow),
          },
          {
            kind: "section",
            label: "Override row cell type",
            helper: "Applies to every cell in this row.",
            onSelect: () => {},
          },
          ...rowCellTypeOverrideOptions.map((option) => ({
            label: option.label,
            active: activeMenuRow.cellTypeOverride === option.value,
            disabled: saving === `row:${activeMenuRow.id}`,
            onSelect: () => updateRowCellTypeOverride(activeMenuRow, option.value),
          })),
        ]
      : [];

  async function loadSpaces() {
    setLoadingSpaces(true);
    setError("");
    try {
      const res = await fetch("/api/spaces", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not load spaces");
      }

      const data = (await res.json()) as SpaceSummary[];
      setSpaces(data);
      setSelectedSpaceId((current) => current ?? data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load spaces");
    } finally {
      setLoadingSpaces(false);
    }
  }

  async function loadSpace(spaceId: string) {
    setLoadingSpace(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 || res.status === 404) {
          setSpaces((current) => current.filter((item) => item.id !== spaceId));
          setSelectedSpaceId((current) => (current === spaceId ? null : current));
          throw new Error("You do not have access to this space");
        }
        throw new Error(err?.error ?? "Could not load space");
      }

      setSpace((await res.json()) as SpaceDetail);
      setMembers([]);
      loadMembers(spaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load space");
      setSpace(null);
    } finally {
      setLoadingSpace(false);
    }
  }

  async function loadMembers(spaceId: string) {
    setLoadingMembers(true);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not load members");
      }

      setMembers((await res.json()) as SpaceMember[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setError("");
    setUsers([]);
    setSelectedMemberUserId("");
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not load users");
      }

      setUsers((await res.json()) as UserOption[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;

    if (!selectedMemberUserId || selectedUserIsMember) return;

    setSaving("member");
    setError("");
    try {
      const res = await fetch(`/api/spaces/${space.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedMemberUserId, role: memberRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not add member");
      }

      const created = (await res.json()) as SpaceMember;
      setMembers((current) => [...current, created]);
      setSelectedMemberUserId("");
      setMemberRole("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setSaving("");
    }
  }

  async function removeMember(memberId: string) {
    if (!space) return;

    setSaving(`member:${memberId}`);
    setError("");
    try {
      const res = await fetch(`/api/spaces/${space.id}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not remove member");
      }

      setMembers((current) => current.filter((member) => member.id !== memberId));
      if (space.currentMember.id === memberId) {
        setSpaces((current) => current.filter((item) => item.id !== space.id));
        setSelectedSpaceId(null);
        setSpace(null);
        setMembersOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setSaving("");
    }
  }

  async function deleteCurrentSpace() {
    if (!space || !canManageMembers) return;

    setSaving("delete-space");
    setError("");
    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not delete space");
      }

      const nextSpaces = spaces.filter((item) => item.id !== space.id);
      setSpaces(nextSpaces);
      setSelectedSpaceId(nextSpaces[0]?.id ?? null);
      setSpace(null);
      setMembers([]);
      setMembersOpen(false);
      setDeleteSpaceOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete space");
    } finally {
      setSaving("");
    }
  }

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    if (selectedSpaceId) {
      loadSpace(selectedSpaceId);
    } else {
      setSpace(null);
      setMembers([]);
    }
  }, [selectedSpaceId]);

  useEffect(() => {
    if (membersOpen && space) {
      loadMembers(space.id);
    }
    if (!space) {
      setMembersOpen(false);
      setMembers([]);
    }
  }, [membersOpen, space?.id]);

  useEffect(() => {
    if (membersOpen && canManageMembers) {
      loadUsers();
    }
  }, [membersOpen, canManageMembers, space?.id]);

  useEffect(() => {
    if (!activeCell) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveCell(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeCell]);

  function toggleMatrixActionMenu(
    kind: MatrixActionMenuState["kind"],
    id: string,
    element: HTMLElement
  ) {
    const anchor = getMenuAnchor(element);
    setMatrixActionMenu((current) =>
      current?.kind === kind && current.id === id ? null : { kind, id, anchor }
    );
  }

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    const name = spaceName.trim();
    if (!name) return;

    setSaving("space");
    setError("");
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not create space");
      }

      const created = (await res.json()) as SpaceSummary;
      setSpaces((current) => [created, ...current]);
      setSelectedSpaceId(created.id);
      setSpaceName("");
      setCreatingSpace(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create space");
    } finally {
      setSaving("");
    }
  }

  async function createRow(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;

    const name = rowName.trim();
    if (!name) return;

    const tempRow: MatrixRow = {
      id: createTempId("row"),
      spaceId: space.id,
      name,
      order: getNextOrder(space.rows),
      isDone: false,
      doneAt: null,
      cellTypeOverride: null,
      isPending: true,
    };

    setSaving("row");
    setError("");
    setRowName("");
    setSpace((current) =>
      current && current.id === space.id
        ? { ...current, rows: [...current.rows, tempRow] }
        : current
    );

    try {
      const res = await fetch(`/api/spaces/${space.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not create row");
      }

      const createdRow = (await res.json()) as MatrixRow;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              rows: current.rows.map((row) =>
                row.id === tempRow.id ? createdRow : row
              ),
            }
          : current
      );
      rowNameInputRef.current?.focus();
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              rows: current.rows.filter((row) => row.id !== tempRow.id),
            }
          : current
      );
      setRowName(name);
      setError(err instanceof Error ? err.message : "Could not create row");
    } finally {
      setSaving("");
    }
  }

  async function patchRow(row: MatrixRow, body: Record<string, unknown>) {
    if (!space) return null;

    const res = await fetch(`/api/spaces/${space.id}/rows/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Could not update row");
    }

    return (await res.json()) as MatrixRow;
  }

  async function renameRow(row: MatrixRow) {
    if (!space) return;

    const nextName = window.prompt("Rename row", row.name)?.trim();
    if (!nextName || nextName === row.name) return;

    const previousRows = space.rows;
    setSaving(`row:${row.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            rows: current.rows.map((item) =>
              item.id === row.id ? { ...item, name: nextName, isPending: true } : item
            ),
          }
        : current
    );

    try {
      const updatedRow = await patchRow(row, { name: nextName });
      setSpace((current) =>
        current && current.id === space.id && updatedRow
          ? {
              ...current,
              rows: current.rows.map((item) => (item.id === row.id ? updatedRow : item)),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id ? { ...current, rows: previousRows } : current
      );
      setError(err instanceof Error ? err.message : "Could not rename row");
    } finally {
      setSaving("");
    }
  }

  async function moveRow(row: MatrixRow, direction: "up" | "down") {
    if (!space) return;

    const rows = orderedRows.filter((item) => item.isDone === row.isDone);
    const currentIndex = rows.findIndex((item) => item.id === row.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetRow = rows[targetIndex];

    if (currentIndex < 0 || !targetRow) return;

    const previousRows = space.rows;
    const nextRows = space.rows.map((item) => {
      if (item.id === row.id) {
        return { ...item, order: targetRow.order, isPending: true };
      }
      if (item.id === targetRow.id) {
        return { ...item, order: row.order, isPending: true };
      }
      return item;
    });

    setSaving(`row-order:${row.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id ? { ...current, rows: nextRows } : current
    );

    try {
      const [updatedRow, updatedTargetRow] = await Promise.all([
        patchRow(row, { order: targetRow.order }),
        patchRow(targetRow, { order: row.order }),
      ]);

      setSpace((current) =>
        current && current.id === space.id && updatedRow && updatedTargetRow
          ? {
              ...current,
              rows: current.rows.map((item) => {
                if (item.id === updatedRow.id) return updatedRow;
                if (item.id === updatedTargetRow.id) return updatedTargetRow;
                return item;
              }),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id ? { ...current, rows: previousRows } : current
      );
      setError(err instanceof Error ? err.message : "Could not reorder rows");
    } finally {
      setSaving("");
    }
  }

  async function toggleRowDone(row: MatrixRow) {
    if (!space) return;

    const nextIsDone = !row.isDone;
    const previousRows = space.rows;
    const optimisticDoneAt = nextIsDone ? new Date().toISOString() : null;

    setSaving(`row:${row.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            rows: current.rows.map((item) =>
              item.id === row.id
                ? {
                    ...item,
                    isDone: nextIsDone,
                    doneAt: optimisticDoneAt,
                    isPending: true,
                  }
                : item
            ),
          }
        : current
    );

    try {
      const updatedRow = await patchRow(row, {
        isDone: nextIsDone,
        doneAt: optimisticDoneAt,
      });
      setSpace((current) =>
        current && current.id === space.id && updatedRow
          ? {
              ...current,
              rows: current.rows.map((item) => (item.id === row.id ? updatedRow : item)),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id ? { ...current, rows: previousRows } : current
      );
      setError(err instanceof Error ? err.message : "Could not update row");
    } finally {
      setSaving("");
    }
  }

  async function updateRowCellTypeOverride(
    row: MatrixRow,
    cellTypeOverride: RowCellTypeOverride | null
  ) {
    if (!space || row.cellTypeOverride === cellTypeOverride) return;

    const previousRows = space.rows;
    setSaving(`row:${row.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            rows: current.rows.map((item) =>
              item.id === row.id
                ? { ...item, cellTypeOverride, isPending: true }
                : item
            ),
          }
        : current
    );

    try {
      const updatedRow = await patchRow(row, { cellTypeOverride });
      setSpace((current) =>
        current && current.id === space.id && updatedRow
          ? {
              ...current,
              rows: current.rows.map((item) => (item.id === row.id ? updatedRow : item)),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id ? { ...current, rows: previousRows } : current
      );
      setError(err instanceof Error ? err.message : "Could not update row cell type");
    } finally {
      setSaving("");
    }
  }

  async function createColumn(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;

    const name = columnName.trim();
    if (!name) return;

    const tempColumn: MatrixColumn = {
      id: createTempId("column"),
      spaceId: space.id,
      name,
      type: columnType,
      order: getNextOrder(space.columns),
      statusOptions: [],
      isPending: true,
    };

    setSaving("column");
    setError("");
    setColumnName("");
    setColumnType("text");
    setSpace((current) =>
      current && current.id === space.id
        ? { ...current, columns: [...current.columns, tempColumn] }
        : current
    );

    try {
      const res = await fetch(`/api/spaces/${space.id}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: columnType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not create column");
      }

      const createdColumn = (await res.json()) as MatrixColumn;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((column) =>
                column.id === tempColumn.id ? createdColumn : column
              ),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.filter(
                (column) => column.id !== tempColumn.id
              ),
            }
          : current
      );
      setColumnName(name);
      setColumnType(columnType);
      setError(err instanceof Error ? err.message : "Could not create column");
    } finally {
      setSaving("");
    }
  }

  async function renameColumn(column: MatrixColumn, name: string) {
    if (!space) return false;

    const nextName = name.trim();
    if (!nextName || nextName === column.name) return true;

    const previousColumns = space.columns;
    setSaving(`column:${column.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            columns: current.columns.map((item) =>
              item.id === column.id ? { ...item, name: nextName, isPending: true } : item
            ),
          }
        : current
    );

    try {
      const res = await fetch(`/api/spaces/${space.id}/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not rename column");
      }

      const updatedColumn = (await res.json()) as MatrixColumn;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((item) =>
                item.id === column.id ? updatedColumn : item
              ),
            }
          : current
      );
      return true;
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? { ...current, columns: previousColumns }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not rename column");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function moveColumn(column: MatrixColumn, direction: "left" | "right") {
    if (!space) return;

    const columns = sortColumns(space.columns);
    const currentIndex = columns.findIndex((item) => item.id === column.id);
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    const targetColumn = columns[targetIndex];

    if (currentIndex < 0 || !targetColumn) return;

    const previousColumns = space.columns;
    const nextColumns = space.columns.map((item) => {
      if (item.id === column.id) {
        return { ...item, order: targetColumn.order, isPending: true };
      }
      if (item.id === targetColumn.id) {
        return { ...item, order: column.order, isPending: true };
      }
      return item;
    });

    setSaving(`column-order:${column.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id ? { ...current, columns: nextColumns } : current
    );

    try {
      const updates = [
        fetch(`/api/spaces/${space.id}/columns/${column.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: targetColumn.order }),
        }),
        fetch(`/api/spaces/${space.id}/columns/${targetColumn.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: column.order }),
        }),
      ];

      const responses = await Promise.all(updates);
      const failed = responses.find((res) => !res.ok);
      if (failed) {
        const err = await failed.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not reorder columns");
      }

      const [updatedColumn, updatedTargetColumn] = (await Promise.all(
        responses.map((res) => res.json())
      )) as MatrixColumn[];

      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((item) => {
                if (item.id === updatedColumn.id) return updatedColumn;
                if (item.id === updatedTargetColumn.id) return updatedTargetColumn;
                return item;
              }),
            }
          : current
      );
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? { ...current, columns: previousColumns }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not reorder columns");
    } finally {
      setSaving("");
    }
  }

  async function createStatusOption(column: MatrixColumn, label: string, color: string) {
    if (!space) return false;

    const nextLabel = label.trim();
    if (!nextLabel) return false;

    const tempOption: StatusOption = {
      id: createTempId("status"),
      columnId: column.id,
      label: nextLabel,
      color,
      order: getNextOrder(column.statusOptions),
    };

    setSaving(`status-option:${column.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            columns: current.columns.map((item) =>
              item.id === column.id
                ? { ...item, statusOptions: [...item.statusOptions, tempOption] }
                : item
            ),
          }
        : current
    );

    try {
      const res = await fetch(
        `/api/spaces/${space.id}/columns/${column.id}/status-options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nextLabel, color }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not add status option");
      }

      const createdOption = (await res.json()) as StatusOption;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((item) =>
                item.id === column.id
                  ? {
                      ...item,
                      statusOptions: item.statusOptions.map((option) =>
                        option.id === tempOption.id ? createdOption : option
                      ),
                    }
                  : item
              ),
            }
          : current
      );
      return true;
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((item) =>
                item.id === column.id
                  ? {
                      ...item,
                      statusOptions: item.statusOptions.filter(
                        (option) => option.id !== tempOption.id
                      ),
                    }
                  : item
              ),
            }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not add status option");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function updateStatusOption(option: StatusOption, label: string, color: string) {
    if (!space) return false;

    const nextLabel = label.trim();
    if (!nextLabel) return false;

    const previousColumns = space.columns;
    setSaving(`status-option:${option.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            columns: current.columns.map((column) =>
              column.id === option.columnId
                ? {
                    ...column,
                    statusOptions: column.statusOptions.map((item) =>
                      item.id === option.id
                        ? { ...item, label: nextLabel, color }
                        : item
                    ),
                  }
                : column
            ),
          }
        : current
    );

    try {
      const res = await fetch(
        `/api/spaces/${space.id}/columns/${option.columnId}/status-options/${option.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nextLabel, color }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not update status option");
      }

      const updatedOption = (await res.json()) as StatusOption;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((column) =>
                column.id === option.columnId
                  ? {
                      ...column,
                      statusOptions: column.statusOptions.map((item) =>
                        item.id === option.id ? updatedOption : item
                      ),
                    }
                  : column
              ),
            }
          : current
      );
      return true;
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? { ...current, columns: previousColumns }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not update status option");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function deleteStatusOption(option: StatusOption) {
    if (!space) return false;

    const previousColumns = space.columns;
    setSaving(`status-option:${option.id}`);
    setError("");

    try {
      const res = await fetch(
        `/api/spaces/${space.id}/columns/${option.columnId}/status-options/${option.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not delete status option");
      }

      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              columns: current.columns.map((column) =>
                column.id === option.columnId
                  ? {
                      ...column,
                      statusOptions: column.statusOptions.filter(
                        (item) => item.id !== option.id
                      ),
                    }
                  : column
              ),
            }
          : current
      );
      return true;
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? { ...current, columns: previousColumns }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not delete status option");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function updateCell(
    row: MatrixRow,
    column: MatrixColumn,
    value: string | number | boolean | null
  ) {
    if (!space) return;

    const previousCell = cellMap.get(`${row.id}:${column.id}`);
    const type = effectiveCellType(row, column);
    const optimisticCell = createOptimisticCell(
      row.id,
      column.id,
      type,
      value,
      previousCell
    );

    setSaving(`${row.id}:${column.id}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            cells: replaceCell(current.cells, row.id, column.id, optimisticCell),
          }
        : current
    );

    try {
      const res = await fetch(`/api/spaces/${space.id}/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: row.id,
          columnId: column.id,
          value,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not update cell");
      }

      const updatedCell = (await res.json()) as MatrixCell;
      setSpace((current) => {
        if (!current) return current;
        return {
          ...current,
          cells: replaceCell(current.cells, row.id, column.id, updatedCell),
        };
      });
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              cells: replaceCell(
                current.cells,
                row.id,
                column.id,
                previousCell ?? null
              ),
            }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not update cell");
    } finally {
      setSaving("");
    }
  }

  async function updateCellDetails(
    row: MatrixRow,
    column: MatrixColumn,
    assignedUserId: string,
    newNote: string
  ) {
    if (!space) return false;

    const key = `${row.id}:${column.id}`;
    const previousCell = cellMap.get(key);
    const trimmedNote = newNote.trim();
    const optimisticCell: MatrixCell = {
      ...(previousCell ?? createBlankCell(row.id, column.id)),
      userIdValue: assignedUserId || null,
      noteHistory:
        trimmedNote && currentSpaceMember
          ? [
              {
                id: createTempId("note"),
                cellId: previousCell?.id ?? "",
                userId: currentSpaceMember.userId,
                content: trimmedNote,
                createdAt: new Date().toISOString(),
                user: currentSpaceMember.user,
                isPending: true,
              },
              ...(previousCell?.noteHistory ?? []),
            ]
          : previousCell?.noteHistory ?? [],
      updatedAt: new Date().toISOString(),
      isPending: true,
    };

    setSaving(`details:${key}`);
    setError("");
    setSpace((current) =>
      current && current.id === space.id
        ? {
            ...current,
            cells: replaceCell(current.cells, row.id, column.id, optimisticCell),
          }
        : current
    );

    try {
      const res = await fetch(`/api/spaces/${space.id}/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: row.id,
          columnId: column.id,
          assignedUserId: assignedUserId || null,
          newNote: trimmedNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not update cell details");
      }

      const updatedCell = (await res.json()) as MatrixCell;
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              cells: replaceCell(current.cells, row.id, column.id, updatedCell),
            }
          : current
      );
      return true;
    } catch (err) {
      setSpace((current) =>
        current && current.id === space.id
          ? {
              ...current,
              cells: replaceCell(
                current.cells,
                row.id,
                column.id,
                previousCell ?? null
              ),
            }
          : current
      );
      setError(err instanceof Error ? err.message : "Could not update cell details");
      return false;
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Collaborative Spaces
          </h1>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
            Basic matrix boards for shared workflow tracking.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <select
            className={inputClassName("w-full sm:w-72")}
            value={selectedSpaceId ?? ""}
            disabled={loadingSpaces || spaces.length === 0}
            onChange={(event) => setSelectedSpaceId(event.target.value || null)}
          >
            {loadingSpaces ? (
              <option value="">Loading spaces...</option>
            ) : spaces.length === 0 ? (
              <option value="">No spaces yet</option>
            ) : (
              spaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            onClick={() => setCreatingSpace((current) => !current)}
          >
            + Space
          </button>
          {creatingSpace ? (
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createSpace}>
              <input
                className={inputClassName("w-full sm:w-56")}
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                placeholder="New space name"
                autoFocus
              />
              <button
                type="submit"
                className="tm-button-primary min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                disabled={saving === "space"}
              >
                {saving === "space" ? "Creating..." : "Create"}
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="min-w-0">
        <section className="min-w-0">
          {!space && !loadingSpace ? (
            <div className="tm-card rounded-xl border p-6 text-sm text-[color:var(--tm-muted)]">
              Select or create a space to start.
            </div>
          ) : null}

          {loadingSpace ? (
            <div className="tm-card rounded-xl border p-6 text-sm text-[color:var(--tm-muted)]">
              Loading matrix...
            </div>
          ) : null}

          {space ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--tm-border)] bg-white/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {space.name}
                    </h2>
                    <p className="text-sm text-[color:var(--tm-muted)]">
                      {space.rows.length} rows, {space.columns.length} columns
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/spaces/${space.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="tm-button inline-flex min-h-9 items-center rounded-[10px] border px-3 text-sm font-medium"
                    >
                      Print / Export PDF
                    </a>
                    <button
                      type="button"
                      className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                      onClick={() => setMembersOpen((current) => !current)}
                    >
                      Members
                    </button>
                    {canManageMembers ? (
                      <button
                        type="button"
                        className="min-h-9 rounded-[10px] border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition hover:bg-red-100"
                        onClick={() => setDeleteSpaceOpen(true)}
                      >
                        Delete Space
                      </button>
                    ) : null}
                  </div>
                </div>

                {membersOpen ? (
                  <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Space members</div>
                        <p className="text-xs text-[color:var(--tm-muted)]">
                          {canManageMembers
                            ? "Owners can add or remove members."
                            : "Only owners can manage members."}
                        </p>
                      </div>

                      {canManageMembers ? (
                        <form
                          className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_8rem_auto]"
                          onSubmit={addMember}
                        >
                          <select
                            className={inputClassName("w-full")}
                            value={selectedMemberUserId}
                            disabled={loadingUsers}
                            onChange={(event) =>
                              setSelectedMemberUserId(event.target.value)
                            }
                          >
                            <option value="">
                              {loadingUsers ? "Loading users..." : "Select user"}
                            </option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name || user.email} ({user.email})
                              </option>
                            ))}
                          </select>
                          <select
                            className={inputClassName("w-full")}
                            value={memberRole}
                            onChange={(event) =>
                              setMemberRole(event.target.value as "member" | "owner")
                            }
                          >
                            <option value="member">member</option>
                            <option value="owner">owner</option>
                          </select>
                          <button
                            type="submit"
                            className="tm-button-primary min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                            disabled={
                              saving === "member" ||
                              !selectedMemberUserId ||
                              selectedUserIsMember
                            }
                          >
                            {saving === "member" ? "Adding..." : "Add"}
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {canManageMembers && selectedUserIsMember ? (
                      <div className="mt-2 text-xs text-amber-700">
                        User is already a member.
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-2">
                      {loadingMembers ? (
                        <div className="text-sm text-[color:var(--tm-muted)]">
                          Loading members...
                        </div>
                      ) : members.length === 0 ? (
                        <div className="text-sm text-[color:var(--tm-muted)]">
                          No members loaded.
                        </div>
                      ) : (
                        members.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[color:var(--tm-border)] bg-white/60 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {member.user.name || member.user.email || member.userId}
                              </div>
                              {member.user.email ? (
                                <div className="truncate text-xs text-[color:var(--tm-muted)]">
                                  {member.user.email}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-[color:var(--tm-border)] bg-white px-2 py-0.5 text-xs font-medium text-[color:var(--tm-muted)]">
                                {member.role}
                              </span>
                              {canManageMembers ? (
                                <button
                                  type="button"
                                  className="tm-button min-h-8 rounded-[10px] border px-2 text-xs font-medium"
                                  disabled={saving === `member:${member.id}`}
                                  onClick={() => removeMember(member.id)}
                                >
                                  {saving === `member:${member.id}`
                                    ? "Removing..."
                                    : "Remove"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 xl:grid-cols-2">
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createRow}>
                    <input
                      ref={rowNameInputRef}
                      className={inputClassName("w-full")}
                      value={rowName}
                      onChange={(event) => setRowName(event.target.value)}
                      placeholder="Row name"
                    />
                    <button
                      type="submit"
                      className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                      disabled={saving === "row"}
                    >
                      {saving === "row" ? "Adding..." : "Add Row"}
                    </button>
                  </form>

                  <form className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]" onSubmit={createColumn}>
                    <input
                      className={inputClassName("w-full")}
                      value={columnName}
                      onChange={(event) => setColumnName(event.target.value)}
                      placeholder="Column name"
                    />
                    <select
                      className={inputClassName("w-full")}
                      value={columnType}
                      onChange={(event) =>
                        setColumnType(event.target.value as ColumnType)
                      }
                    >
                      {columnTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                      disabled={saving === "column"}
                    >
                      {saving === "column" ? "Adding..." : "Add Column"}
                    </button>
                  </form>
                </div>
              </div>

              <div className="tm-card min-w-0 overflow-visible rounded-xl border">
                {space.rows.length === 0 || space.columns.length === 0 ? (
                  <div className="p-6 text-sm text-[color:var(--tm-muted)]">
                    Add at least one row and one column to edit cells.
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-0">
                    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--tm-border)] px-3 py-2">
                      <div className="text-xs text-[color:var(--tm-muted)]">
                        {orderedRows.length} visible row{orderedRows.length === 1 ? "" : "s"}
                        {hiddenDoneRowCount > 0 ? `, ${hiddenDoneRowCount} done` : ""}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[color:var(--tm-muted)]">
                        <input
                          type="checkbox"
                          checked={showDoneRows}
                          onChange={(event) => setShowDoneRows(event.target.checked)}
                        />
                        Show done rows
                      </label>
                    </div>
                    {orderedRows.length === 0 ? (
                      <div className="p-6 text-sm text-[color:var(--tm-muted)]">
                        All rows are done. Turn on Show done rows to view them.
                      </div>
                    ) : (
                  <div className="max-h-[calc(100vh-18rem)] min-w-0 overflow-auto overscroll-contain rounded-xl">
                    <table className="w-max min-w-full table-fixed border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--tm-border)]">
                          <th className="sticky left-0 top-0 z-50 w-[200px] min-w-[200px] bg-[color:var(--tm-card)] px-3 py-1.5 text-left font-semibold shadow-[4px_0_0_0_rgba(255,255,255,0.9)]">
                            Row
                          </th>
                          {orderedColumns.map((column, columnIndex) => (
                            <th
                              key={column.id}
                              className={`sticky top-0 z-40 border-l border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-2 py-1.5 text-left font-semibold ${
                                columnIndex === 0 ? "pl-3" : ""
                              } ${columnWidthClassName(column.type)}`}
                            >
                              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.5rem] items-start gap-1.5">
                                <div className="min-w-0 pr-1">
                                  <span
                                    className="line-clamp-2 break-words text-[13px] leading-4"
                                    title={column.name}
                                  >
                                    {column.name}
                                  </span>
                                  <div className="mt-0.5 flex min-h-4 items-center gap-1 text-[11px] font-normal text-[color:var(--tm-muted)]">
                                    <span>{column.isPending ? "saving..." : column.type}</span>
                                    {column.type === "status" && column.statusOptions.length > 0 ? (
                                      <span className="flex items-center gap-0.5">
                                        {column.statusOptions.slice(0, 5).map((option) => (
                                          <span
                                            key={option.id}
                                            className={statusDotClassName(option.color)}
                                            title={statusLabel(option)}
                                            role="img"
                                            aria-label={statusLabel(option)}
                                          />
                                        ))}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="flex h-6 w-6 shrink-0 items-center justify-center justify-self-end rounded-full border border-[color:var(--tm-border)] bg-white/70 text-xs text-[color:var(--tm-muted)] transition hover:bg-white hover:text-[color:var(--tm-text)]"
                                  aria-label={`Configure ${column.name}`}
                                  title="Column settings"
                                  onClick={(event) =>
                                    toggleMatrixActionMenu("column", column.id, event.currentTarget)
                                  }
                                >
                                  ⋯
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderedRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`tm-table-row border-b last:border-b-0 ${
                              row.isDone ? "opacity-60" : ""
                            }`}
                          >
                            <th className="sticky left-0 z-30 w-[200px] min-w-[200px] bg-[color:var(--tm-card)] px-3 py-1.5 text-left font-medium shadow-[4px_0_0_0_rgba(255,255,255,0.9)]">
                              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.5rem] items-start gap-1.5">
                                <div className="min-w-0">
                                  <span
                                    className={`inline min-w-0 truncate ${
                                      row.isDone ? "line-through" : ""
                                    }`}
                                    title={row.name}
                                  >
                                    {row.name}
                                  </span>
                                  {row.cellTypeOverride ? (
                                    <span className="ml-1 text-xs font-normal text-[color:var(--tm-muted)]">
                                      · {formatCellTypeLabel(row.cellTypeOverride)} row
                                    </span>
                                  ) : null}
                                  <div className="min-h-4 text-xs font-normal text-[color:var(--tm-muted)]">
                                    {row.isPending ? "saving..." : row.isDone ? "done" : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="flex h-6 w-6 shrink-0 items-center justify-center justify-self-end rounded-full border border-[color:var(--tm-border)] bg-white/70 text-xs text-[color:var(--tm-muted)] transition hover:bg-white hover:text-[color:var(--tm-text)]"
                                  aria-label={`Row actions for ${row.name}`}
                                  title="Row actions"
                                  onClick={(event) =>
                                    toggleMatrixActionMenu("row", row.id, event.currentTarget)
                                  }
                                >
                                  ⋯
                                </button>
                              </div>
                            </th>
                            {orderedColumns.map((column) => {
                              const cell = cellMap.get(`${row.id}:${column.id}`);
                              const key = `${row.id}:${column.id}`;
                              const type = effectiveCellType(row, column);
                              const statusColumn = statusColumnForCell(
                                row,
                                column,
                                orderedColumns
                              );
                              const assignedMember = cell?.userIdValue
                                ? memberMap.get(cell.userIdValue)
                                : undefined;
                              const hasNotes = Boolean(cell?.noteHistory?.length);
                              return (
                                <td
                                  key={column.id}
                                  className={`border-l border-[color:var(--tm-border)] px-1.5 py-1 align-middle ${
                                    column === orderedColumns[0] ? "pl-2.5" : ""
                                  } ${cellWidthClassName(column, type)}`}
                                >
                                  <div className="flex min-w-0 items-center gap-1">
                                    <div className="min-w-0 flex-1">
                                      <CellEditor
                                        type={type}
                                        statusOptions={statusColumn?.statusOptions ?? []}
                                        statusOptionsUnavailable={
                                          type === "status" && !statusColumn
                                        }
                                        value={cellDisplayValue(cell, type)}
                                        saving={saving === key}
                                        onSave={(value) => updateCell(row, column, value)}
                                      />
                                    </div>
                                    {hasNotes ? (
                                      <button
                                        type="button"
                                        className="flex min-h-8 min-w-6 items-center justify-center text-sm opacity-55 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                        aria-label="Open cell notes"
                                        title={`${cell?.noteHistory.length ?? 0} notes`}
                                        onClick={() =>
                                          setActiveCell({
                                            rowId: row.id,
                                            columnId: column.id,
                                          })
                                        }
                                      >
                                        📝
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="flex min-h-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--tm-border)] bg-white/75 text-xs font-semibold text-[color:var(--tm-muted)] transition hover:bg-white hover:text-[color:var(--tm-text)] focus:outline-none focus:ring-2 focus:ring-slate-200"
                                      aria-label="Open cell details"
                                      title={
                                        assignedMember
                                          ? `Assigned to ${memberDisplayName(assignedMember)}`
                                          : "Open cell details"
                                      }
                                      onClick={() =>
                                        setActiveCell({
                                          rowId: row.id,
                                          columnId: column.id,
                                        })
                                      }
                                    >
                                      {assignedMember ? memberInitials(assignedMember) : "+"}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {space && deleteSpaceOpen && canManageMembers ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/15 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete space"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteSpaceOpen(false);
            }
          }}
        >
          <div className="tm-card w-full max-w-md rounded-xl border p-4 shadow-xl">
            <div className="text-lg font-semibold">Delete space</div>
            <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
              This will permanently delete this space, including rows, columns,
              cells, notes and status options.
            </p>
            <p className="mt-3 text-sm">
              Delete <span className="font-semibold">{space.name}</span>?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                disabled={saving === "delete-space"}
                onClick={() => setDeleteSpaceOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-9 rounded-[10px] border border-red-200 bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                disabled={saving === "delete-space"}
                onClick={() => void deleteCurrentSpace()}
              >
                {saving === "delete-space" ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {matrixActionMenu && matrixMenuItems.length > 0 ? (
        <FloatingActionMenu
          anchor={matrixActionMenu.anchor}
          items={matrixMenuItems}
          onClose={() => setMatrixActionMenu(null)}
        />
      ) : null}

      {space && activeRow && activeColumn ? (
        <CellDetailsPanel
          row={activeRow}
          column={activeColumn}
          cell={activeMatrixCell}
          members={members}
          assignedMember={
            activeMatrixCell?.userIdValue
              ? memberMap.get(activeMatrixCell.userIdValue)
              : undefined
          }
          saving={
            saving === `details:${activeRow.id}:${activeColumn.id}` ||
            saving === `${activeRow.id}:${activeColumn.id}`
          }
          currentMember={currentSpaceMember}
          onClose={() => setActiveCell(null)}
          onSave={(assignedUserId, newNote) =>
            updateCellDetails(activeRow, activeColumn, assignedUserId, newNote)
          }
        />
      ) : null}

      {space && configuringColumn ? (
        <ColumnConfigPanel
          column={configuringColumn}
          statusUsageCounts={space.cells.reduce<Record<string, number>>((counts, cell) => {
            if (cell.statusOptionId) {
              counts[cell.statusOptionId] = (counts[cell.statusOptionId] ?? 0) + 1;
            }
            return counts;
          }, {})}
          saving={saving}
          onClose={() => setConfiguringColumnId(null)}
          onRename={renameColumn}
          onCreateStatusOption={createStatusOption}
          onUpdateStatusOption={updateStatusOption}
          onDeleteStatusOption={deleteStatusOption}
        />
      ) : null}
    </main>
  );
}

type CellEditorProps = {
  type: EffectiveCellType;
  statusOptions: StatusOption[];
  statusOptionsUnavailable: boolean;
  value: string | boolean;
  saving: boolean;
  onSave: (value: string | number | boolean | null) => void;
};

type CellDetailsPanelProps = {
  row: MatrixRow;
  column: MatrixColumn;
  cell: MatrixCell | undefined;
  members: SpaceMember[];
  assignedMember: SpaceMember | undefined;
  saving: boolean;
  currentMember: SpaceMember | undefined;
  onClose: () => void;
  onSave: (assignedUserId: string, newNote: string) => Promise<boolean>;
};

function FloatingActionMenu({
  anchor,
  items,
  onClose,
}: {
  anchor: MenuAnchor;
  items: FloatingMenuItem[];
  onClose: () => void;
}) {
  const menuWidth = 224;
  const menuHeight = Math.max(
    44,
    items.reduce((height, item) => height + (item.kind === "section" ? 52 : 37), 12)
  );
  const gutter = 8;
  const left = Math.min(
    Math.max(gutter, anchor.right - menuWidth),
    Math.max(gutter, window.innerWidth - menuWidth - gutter)
  );
  const opensUp =
    window.innerHeight - anchor.bottom < menuHeight + gutter &&
    anchor.top > menuHeight + gutter;
  const top = opensUp ? anchor.top - menuHeight - gutter : anchor.bottom + gutter;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      onPointerDown={onClose}
    >
      <div
        className="tm-menu fixed overflow-hidden rounded-lg border py-1 shadow-2xl"
        role="menu"
        style={{ left, top, width: menuWidth }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {items.map((item) =>
          item.kind === "section" ? (
            <div
              key={item.label}
              className="border-t border-[color:var(--tm-border)] px-3 pb-1.5 pt-2 first:border-t-0"
              role="presentation"
            >
              <div className="text-xs font-semibold text-[color:var(--tm-text)]">
                {item.label}
              </div>
              {item.helper ? (
                <div className="mt-0.5 text-[11px] leading-4 text-[color:var(--tm-muted)]">
                  {item.helper}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              key={item.label}
              type="button"
              className="grid w-full grid-cols-[1rem_minmax(0,1fr)] items-center gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-white/70 disabled:opacity-50"
              disabled={item.disabled}
              role="menuitem"
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              <span className="text-xs text-[color:var(--tm-muted)]">
                {item.active ? "✓" : ""}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  );
}

function CellDetailsPanel({
  row,
  column,
  cell,
  members,
  assignedMember,
  saving,
  currentMember,
  onClose,
  onSave,
}: CellDetailsPanelProps) {
  const [assignedUserId, setAssignedUserId] = useState(cell?.userIdValue ?? "");
  const [newNote, setNewNote] = useState("");
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  useEffect(() => {
    setAssignedUserId(cell?.userIdValue ?? "");
    setNewNote("");
    setConfirmDiscardOpen(false);
  }, [cell?.id, cell?.userIdValue]);

  const hasUnsavedChanges =
    assignedUserId !== (cell?.userIdValue ?? "") || newNote.trim().length > 0;

  function requestClose() {
    if (saving) return;
    if (hasUnsavedChanges) {
      setConfirmDiscardOpen(true);
      return;
    }

    onClose();
  }

  async function saveDetails() {
    const saved = await onSave(assignedUserId, newNote);
    if (saved) {
      setNewNote("");
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/15 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cell details"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className="tm-card w-full max-w-md rounded-xl border p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Cell details</div>
            <div className="mt-0.5 truncate text-xs text-[color:var(--tm-muted)]">
              {row.name} / {column.name}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close cell details"
            className="tm-button inline-flex h-9 w-9 items-center justify-center rounded-[10px] border text-lg leading-none"
            onClick={requestClose}
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase text-[color:var(--tm-muted)]">
              Assigned
            </span>
            <select
              className={inputClassName("w-full")}
              value={assignedUserId}
              disabled={saving}
              onChange={(event) => setAssignedUserId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {memberDisplayName(member)}
                </option>
              ))}
            </select>
          </label>

          {assignedMember ? (
            <div className="flex items-center gap-2 text-xs text-[color:var(--tm-muted)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--tm-border)] bg-white text-xs font-semibold text-[color:var(--tm-text)]">
                {memberInitials(assignedMember)}
              </span>
              Assigned to {memberDisplayName(assignedMember)}
            </div>
          ) : null}

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase text-[color:var(--tm-muted)]">
              Add note
            </span>
            <textarea
              className={inputClassName("min-h-32 w-full resize-y whitespace-pre-wrap")}
              value={newNote}
              disabled={saving}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="Add a note..."
            />
          </label>

          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase text-[color:var(--tm-muted)]">
              Note history
            </div>
            {cell?.noteHistory?.length ? (
              <div className="max-h-56 overflow-auto rounded-[10px] border border-[color:var(--tm-border)] bg-white/60">
                {cell.noteHistory.map((note) => (
                  <div
                    key={note.id}
                    className="border-b border-[color:var(--tm-border)] px-3 py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
                      <span className="truncate font-medium text-[color:var(--tm-text)]">
                        {note.user.name || note.user.email || note.userId}
                      </span>
                      <span className="text-[color:var(--tm-muted)]">•</span>
                      <span className="shrink-0 text-xs text-[color:var(--tm-muted)]">
                        {formatNoteDate(note.createdAt)}
                      </span>
                      {note.isPending ? (
                        <span className="shrink-0 text-xs text-[color:var(--tm-muted)]">
                          saving...
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap pl-4 text-sm leading-snug">
                      {note.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/60 p-3 text-sm text-[color:var(--tm-muted)]">
                No notes yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            onClick={requestClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tm-button-primary min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            onClick={saveDetails}
            disabled={saving}
            title={
              currentMember
                ? "Save & Close"
                : "Member information is still loading"
            }
          >
            {saving ? "Saving..." : "Save & Close"}
          </button>
        </div>
        <DiscardChangesModal
          open={confirmDiscardOpen}
          onKeepEditing={() => setConfirmDiscardOpen(false)}
          onDiscardChanges={() => {
            setConfirmDiscardOpen(false);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

type ColumnConfigPanelProps = {
  column: MatrixColumn;
  statusUsageCounts: Record<string, number>;
  saving: string;
  onClose: () => void;
  onRename: (column: MatrixColumn, name: string) => Promise<boolean>;
  onCreateStatusOption: (
    column: MatrixColumn,
    label: string,
    color: string
  ) => Promise<boolean>;
  onUpdateStatusOption: (
    option: StatusOption,
    label: string,
    color: string
  ) => Promise<boolean>;
  onDeleteStatusOption: (option: StatusOption) => Promise<boolean>;
};

function ColumnConfigPanel({
  column,
  statusUsageCounts,
  saving,
  onClose,
  onRename,
  onCreateStatusOption,
  onUpdateStatusOption,
  onDeleteStatusOption,
}: ColumnConfigPanelProps) {
  const [columnName, setColumnName] = useState(column.name);
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("neutral");
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, { label: string; color: string }>
  >({});
  const [localMessage, setLocalMessage] = useState("");

  useEffect(() => {
    setColumnName(column.name);
    setStatusDrafts(
      Object.fromEntries(
        column.statusOptions.map((option) => [
          option.id,
          { label: option.label, color: option.color },
        ])
      )
    );
    setNewStatusLabel("");
    setNewStatusColor("neutral");
    setLocalMessage("");
  }, [column.id, column.name, column.statusOptions]);

  async function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const saved = await onRename(column, columnName);
    if (saved) {
      onClose();
    } else {
      setLocalMessage("Could not rename column.");
    }
  }

  async function submitNewStatusOption(event: React.FormEvent) {
    event.preventDefault();
    const saved = await onCreateStatusOption(column, newStatusLabel, newStatusColor);
    if (saved) {
      setNewStatusLabel("");
      setNewStatusColor("neutral");
      onClose();
    } else {
      setLocalMessage("Could not add status option.");
    }
  }

  async function saveStatusOption(option: StatusOption) {
    const draft = statusDrafts[option.id] ?? {
      label: option.label,
      color: option.color,
    };
    const saved = await onUpdateStatusOption(option, draft.label, draft.color);
    if (saved) {
      onClose();
    } else {
      setLocalMessage("Could not update status option.");
    }
  }

  async function removeStatusOption(option: StatusOption) {
    const usageCount = statusUsageCounts[option.id] ?? 0;
    if (usageCount > 0) {
      setLocalMessage(
        `Cannot delete "${option.label}" because ${usageCount} cell${
          usageCount === 1 ? " is" : "s are"
        } using it.`
      );
      return;
    }

    const deleted = await onDeleteStatusOption(option);
    if (deleted) {
      onClose();
    } else {
      setLocalMessage("Could not delete status option.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/15 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Column settings"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="tm-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Column settings</div>
            <div className="mt-0.5 truncate text-xs text-[color:var(--tm-muted)]">
              {column.type}
            </div>
          </div>
          <button
            type="button"
            className="tm-button min-h-8 rounded-[10px] border px-2 text-xs font-medium"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={submitRename}>
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase text-[color:var(--tm-muted)]">
              Name
            </span>
            <input
              className={inputClassName("w-full")}
              value={columnName}
              onChange={(event) => setColumnName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="tm-button-primary self-end min-h-9 rounded-[10px] border px-3 text-sm font-medium"
            disabled={saving === `column:${column.id}` || !columnName.trim()}
          >
            {saving === `column:${column.id}` ? "Saving..." : "Rename"}
          </button>
        </form>

        {column.type === "status" ? (
          <div className="mt-5 grid gap-3">
            <div>
              <div className="text-sm font-semibold">Status options</div>
              <div className="text-xs text-[color:var(--tm-muted)]">
                Changes update existing cells immediately because cells keep the same option id.
              </div>
            </div>

            <div className="grid gap-2">
              {column.statusOptions.length === 0 ? (
                <div className="rounded-[10px] border border-[color:var(--tm-border)] bg-white/60 p-3 text-sm text-[color:var(--tm-muted)]">
                  No status options yet.
                </div>
              ) : (
                column.statusOptions.map((option) => {
                  const draft = statusDrafts[option.id] ?? {
                    label: option.label,
                    color: option.color,
                  };
                  const usageCount = statusUsageCounts[option.id] ?? 0;
                  const optionSaving = saving === `status-option:${option.id}`;

                  return (
                    <div
                      key={option.id}
                      className="grid gap-2 rounded-[10px] border border-[color:var(--tm-border)] bg-white/60 p-2 sm:grid-cols-[minmax(10rem,1fr)_9rem_auto_auto]"
                    >
                      <input
                        className={inputClassName("w-full")}
                        value={draft.label}
                        disabled={optionSaving}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [option.id]: {
                              ...draft,
                              label: event.target.value,
                            },
                          }))
                        }
                      />
                      <select
                        className={inputClassName("w-full")}
                        value={draft.color}
                        disabled={optionSaving}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [option.id]: {
                              ...draft,
                              color: event.target.value,
                            },
                          }))
                        }
                      >
                        {statusColorOptions.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`${statusPillClassName(draft.color)} flex min-h-9 items-center`}
                        title={`Status: ${draft.label.trim() || "Label"}`}
                        role="img"
                        aria-label={`Status: ${draft.label.trim() || "Label"}`}
                      >
                        {draft.label.trim() || "Label"}
                      </span>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-[color:var(--tm-muted)]">
                          {usageCount} used
                        </span>
                        <button
                          type="button"
                          className="tm-button min-h-8 rounded-[10px] border px-2 text-xs font-medium"
                          disabled={optionSaving || !draft.label.trim()}
                          onClick={() => saveStatusOption(option)}
                        >
                          {optionSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="min-h-8 rounded-[10px] border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          disabled={optionSaving}
                          onClick={() => removeStatusOption(option)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              className="grid gap-2 rounded-[10px] border border-[color:var(--tm-border)] bg-white/40 p-3 sm:grid-cols-[1fr_9rem_auto]"
              onSubmit={submitNewStatusOption}
            >
              <input
                className={inputClassName("w-full")}
                value={newStatusLabel}
                onChange={(event) => setNewStatusLabel(event.target.value)}
                placeholder="New status label"
              />
              <select
                className={inputClassName("w-full")}
                value={newStatusColor}
                onChange={(event) => setNewStatusColor(event.target.value)}
              >
                {statusColorOptions.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="tm-button-primary min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                disabled={saving === `status-option:${column.id}` || !newStatusLabel.trim()}
              >
                {saving === `status-option:${column.id}` ? "Adding..." : "Add"}
              </button>
            </form>
          </div>
        ) : null}

        {localMessage ? (
          <div className="mt-4 rounded-[10px] border border-[color:var(--tm-border)] bg-white/60 px-3 py-2 text-sm text-[color:var(--tm-muted)]">
            {localMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CellEditor({
  type,
  statusOptions,
  statusOptionsUnavailable,
  value,
  saving,
  onSave,
}: CellEditorProps) {
  const [draft, setDraft] = useState(value);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  useEffect(() => {
    setDraft(value);
    setEditingStatus(false);
    setEditingDate(false);
  }, [type, value]);

  if (type === "checkbox") {
    return (
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-[color:var(--tm-border)]"
        checked={Boolean(draft)}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.target.checked);
          onSave(event.target.checked);
        }}
      />
    );
  }

  if (type === "date") {
    const dateValue = typeof draft === "string" ? draft : "";

    if (!editingDate) {
      return (
        <button
          type="button"
          className="flex min-h-8 w-full min-w-[5.6rem] items-center rounded-[10px] border border-transparent px-1.5 text-left text-sm tabular-nums transition hover:border-[color:var(--tm-border)] hover:bg-white/55 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-70"
          disabled={saving}
          title={dateValue || "Set date"}
          aria-label={dateValue ? `Date ${formatCompactDate(dateValue)}` : "Set date"}
          onClick={() => setEditingDate(true)}
        >
          {dateValue ? (
            <span className="truncate">{formatCompactDate(dateValue)}</span>
          ) : (
            <span className="truncate text-[color:var(--tm-muted)]">dd mmm yy</span>
          )}
        </button>
      );
    }

    return (
      <input
        autoFocus
        type="date"
        className={inputClassName("w-full min-w-[7rem] px-1.5")}
        value={dateValue}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.target.value);
          onSave(event.target.value || null);
        }}
        onBlur={() => setEditingDate(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  if (type === "status") {
    if (statusOptionsUnavailable) {
      return (
        <span className="text-xs text-[color:var(--tm-muted)]">
          No status column
        </span>
      );
    }

    if (statusOptions.length === 0) {
      return <span className="text-xs text-[color:var(--tm-muted)]">No options</span>;
    }

    const selectedOption =
      typeof draft === "string"
        ? statusOptions.find((option) => option.id === draft)
        : undefined;

    if (!editingStatus) {
      return (
        <button
          type="button"
          className="flex min-h-8 w-full items-center justify-center rounded-[10px] border border-transparent transition hover:border-[color:var(--tm-border)] hover:bg-white/55 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-70"
          disabled={saving}
          title={statusLabel(selectedOption)}
          aria-label={statusLabel(selectedOption)}
          onClick={() => setEditingStatus(true)}
        >
          {selectedOption ? (
            <span
              className={statusIndicatorClassName(selectedOption.color)}
              aria-hidden="true"
            />
          ) : (
            <span className="h-5 w-10 rounded-full border border-dashed border-[color:var(--tm-border)] bg-white/60" />
          )}
        </button>
      );
    }

    return (
      <select
        autoFocus
        className={statusPillClassName(selectedOption?.color)}
        value={typeof draft === "string" ? draft : ""}
        disabled={saving}
        onBlur={() => setEditingStatus(false)}
        onChange={(event) => {
          setDraft(event.target.value);
          onSave(event.target.value || null);
          setEditingStatus(false);
        }}
      >
        <option value="">Select status</option>
        {statusOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const inputType =
    type === "number" ? "number" : "text";
  const placeholder = type === "user" ? "User id" : "";

  function saveDraft() {
    if (type === "number") {
      onSave(draft === "" ? null : Number(draft));
      return;
    }
    onSave(typeof draft === "string" && draft.trim() === "" ? null : draft);
  }

  return (
    <input
      type={inputType}
      className={inputClassName("w-full")}
      value={typeof draft === "string" ? draft : ""}
      disabled={saving}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={saveDraft}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
