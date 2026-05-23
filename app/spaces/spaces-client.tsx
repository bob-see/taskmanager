"use client";

import { useEffect, useMemo, useState } from "react";

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

const columnTypes: ColumnType[] = [
  "status",
  "text",
  "number",
  "date",
  "checkbox",
  "user",
];

const statusColorClasses: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-800",
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  gray: "border-slate-200 bg-slate-50 text-slate-700",
  grey: "border-slate-200 bg-slate-50 text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  yellow: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  green: "border-green-200 bg-green-50 text-green-800",
};

const neutralStatusClasses = "border-[color:var(--tm-border)] bg-white/70 text-[color:var(--tm-muted)]";

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function cellDisplayValue(cell: MatrixCell | undefined, column: MatrixColumn) {
  if (!cell) return "";
  if (column.type === "text") return cell.textValue ?? "";
  if (column.type === "number") return cell.numberValue?.toString() ?? "";
  if (column.type === "date") return toDateInputValue(cell.dateValue);
  if (column.type === "checkbox") return cell.booleanValue ?? false;
  if (column.type === "user") return cell.userIdValue ?? "";
  return cell.statusOptionId ?? "";
}

function createTempId(prefix: string) {
  return `temp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getNextOrder(items: { order: number }[]) {
  return Math.max(-1, ...items.map((item) => item.order)) + 1;
}

function createOptimisticCell(
  rowId: string,
  columnId: string,
  columnType: ColumnType,
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

  if (columnType === "text") {
    return { ...cell, textValue: value === null || value === "" ? null : String(value) };
  }
  if (columnType === "number") {
    return { ...cell, numberValue: value === null || value === "" ? null : Number(value) };
  }
  if (columnType === "date") {
    return { ...cell, dateValue: value === null || value === "" ? null : String(value) };
  }
  if (columnType === "checkbox") {
    return { ...cell, booleanValue: Boolean(value) };
  }
  if (columnType === "user") {
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
  const [activeCell, setActiveCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

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
    if (membersOpen && canManageMembers && users.length === 0) {
      loadUsers();
    }
  }, [membersOpen, canManageMembers, users.length]);

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

  async function updateCell(
    row: MatrixRow,
    column: MatrixColumn,
    value: string | number | boolean | null
  ) {
    if (!space) return;

    const previousCell = cellMap.get(`${row.id}:${column.id}`);
    const optimisticCell = createOptimisticCell(
      row.id,
      column.id,
      column.type,
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
                  <button
                    type="button"
                    className="tm-button min-h-9 rounded-[10px] border px-3 text-sm font-medium"
                    onClick={() => setMembersOpen((current) => !current)}
                  >
                    Members
                  </button>
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

              <div className="tm-card min-w-0 overflow-hidden rounded-xl border">
                {space.rows.length === 0 || space.columns.length === 0 ? (
                  <div className="p-6 text-sm text-[color:var(--tm-muted)]">
                    Add at least one row and one column to edit cells.
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-15rem)] overflow-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--tm-border)]">
                          <th className="sticky left-0 top-0 z-30 min-w-44 bg-[color:var(--tm-card)] px-2.5 py-2 text-left font-semibold">
                            Row
                          </th>
                          {space.columns.map((column) => (
                            <th
                              key={column.id}
                              className="sticky top-0 z-20 min-w-40 bg-[color:var(--tm-card)] px-2.5 py-2 text-left font-semibold"
                            >
                              <span className="block truncate">{column.name}</span>
                              <span className="text-xs font-normal text-[color:var(--tm-muted)]">
                                {column.isPending ? "saving..." : column.type}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {space.rows.map((row) => (
                          <tr
                            key={row.id}
                            className="tm-table-row border-b last:border-b-0"
                          >
                            <th className="sticky left-0 z-10 min-w-44 bg-[color:var(--tm-card)] px-2.5 py-2 text-left font-medium">
                              <span className="block truncate">{row.name}</span>
                              {row.isPending ? (
                                <span className="text-xs font-normal text-[color:var(--tm-muted)]">
                                  saving...
                                </span>
                              ) : null}
                            </th>
                            {space.columns.map((column) => {
                              const cell = cellMap.get(`${row.id}:${column.id}`);
                              const key = `${row.id}:${column.id}`;
                              const assignedMember = cell?.userIdValue
                                ? memberMap.get(cell.userIdValue)
                                : undefined;
                              const hasNotes = Boolean(cell?.noteHistory?.length);
                              return (
                                <td key={column.id} className="px-2 py-1.5 align-middle">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <div className="min-w-0 flex-1">
                                      <CellEditor
                                        cell={cell}
                                        column={column}
                                        value={cellDisplayValue(cell, column)}
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
            </div>
          ) : null}
        </section>
      </div>

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
    </main>
  );
}

type CellEditorProps = {
  cell: MatrixCell | undefined;
  column: MatrixColumn;
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

  useEffect(() => {
    setAssignedUserId(cell?.userIdValue ?? "");
    setNewNote("");
  }, [cell?.id, cell?.userIdValue]);

  async function saveDetails() {
    const saved = await onSave(assignedUserId, newNote);
    if (saved) {
      setNewNote("");
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
          onClose();
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
            className="tm-button min-h-8 rounded-[10px] border px-2 text-xs font-medium"
            onClick={onClose}
          >
            Close
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
            onClick={onClose}
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
                ? "Save cell details"
                : "Member information is still loading"
            }
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CellEditor({ column, value, saving, onSave }: CellEditorProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (column.type === "checkbox") {
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

  if (column.type === "status") {
    if (column.statusOptions.length === 0) {
      return <span className="text-xs text-[color:var(--tm-muted)]">No options</span>;
    }

    const selectedOption =
      typeof draft === "string"
        ? column.statusOptions.find((option) => option.id === draft)
        : undefined;

    return (
      <select
        className={statusPillClassName(selectedOption?.color)}
        value={typeof draft === "string" ? draft : ""}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.target.value);
          onSave(event.target.value || null);
        }}
      >
        <option value="">Select status</option>
        {column.statusOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const inputType =
    column.type === "number" ? "number" : column.type === "date" ? "date" : "text";
  const placeholder = column.type === "user" ? "User id" : "";

  function saveDraft() {
    if (column.type === "number") {
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
