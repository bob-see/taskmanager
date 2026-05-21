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
  updatedAt: string;
  isPending?: boolean;
};

type SpaceDetail = SpaceSummary & {
  rows: MatrixRow[];
  columns: MatrixColumn[];
  cells: MatrixCell[];
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
  value: string | number | boolean | null
): MatrixCell {
  const cell: MatrixCell = {
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
    updatedAt: new Date().toISOString(),
    isPending: true,
  };

  if (value === null || value === "") return cell;
  if (columnType === "text") return { ...cell, textValue: String(value) };
  if (columnType === "number") return { ...cell, numberValue: Number(value) };
  if (columnType === "date") return { ...cell, dateValue: String(value) };
  if (columnType === "checkbox") return { ...cell, booleanValue: Boolean(value) };
  if (columnType === "user") return { ...cell, userIdValue: String(value) };
  return { ...cell, statusOptionId: String(value) };
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
    "tm-input min-h-10 rounded-[10px] border px-3 py-2 text-sm outline-none",
    "focus:border-slate-300 focus:ring-2 focus:ring-slate-200",
    extra,
  ].join(" ");
}

export function SpacesClient() {
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingSpace, setLoadingSpace] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [rowName, setRowName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("text");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const cellMap = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    for (const cell of space?.cells ?? []) {
      map.set(`${cell.rowId}:${cell.columnId}`, cell);
    }
    return map;
  }, [space?.cells]);

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
        throw new Error(err?.error ?? "Could not load space");
      }

      setSpace((await res.json()) as SpaceDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load space");
      setSpace(null);
    } finally {
      setLoadingSpace(false);
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
    }
  }, [selectedSpaceId]);

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
      value
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Collaborative Spaces
          </h1>
          <p className="mt-1 text-sm text-[color:var(--tm-muted)]">
            Basic matrix boards for shared workflow tracking.
          </p>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createSpace}>
          <input
            className={inputClassName("w-full sm:w-64")}
            value={spaceName}
            onChange={(event) => setSpaceName(event.target.value)}
            placeholder="New space name"
          />
          <button
            type="submit"
            className="tm-button-primary min-h-10 rounded-[10px] border px-4 text-sm font-medium"
            disabled={saving === "space"}
          >
            {saving === "space" ? "Creating..." : "Create Space"}
          </button>
        </form>
      </header>

      {error ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="tm-card rounded-xl border p-3">
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tm-muted)]">
            Spaces
          </div>
          {loadingSpaces ? (
            <p className="px-1 py-3 text-sm text-[color:var(--tm-muted)]">
              Loading spaces...
            </p>
          ) : spaces.length === 0 ? (
            <p className="px-1 py-3 text-sm text-[color:var(--tm-muted)]">
              No spaces yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {spaces.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    "rounded-[10px] px-3 py-2 text-left text-sm transition",
                    selectedSpaceId === item.id
                      ? "bg-white font-medium shadow-sm ring-1 ring-[color:var(--tm-border)]"
                      : "text-[color:var(--tm-muted)] hover:bg-white/70 hover:text-[color:var(--tm-text)]",
                  ].join(" ")}
                  onClick={() => setSelectedSpaceId(item.id)}
                >
                  <span className="block truncate">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

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
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--tm-border)] bg-white/30 p-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {space.name}
                  </h2>
                  <p className="text-sm text-[color:var(--tm-muted)]">
                    {space.rows.length} rows, {space.columns.length} columns
                  </p>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createRow}>
                    <input
                      className={inputClassName("w-full")}
                      value={rowName}
                      onChange={(event) => setRowName(event.target.value)}
                      placeholder="Row name"
                    />
                    <button
                      type="submit"
                      className="tm-button min-h-10 rounded-[10px] border px-4 text-sm font-medium"
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
                      className="tm-button min-h-10 rounded-[10px] border px-4 text-sm font-medium"
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
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--tm-border)]">
                          <th className="sticky left-0 z-10 min-w-48 bg-[color:var(--tm-card)] px-3 py-3 text-left font-semibold">
                            Row
                          </th>
                          {space.columns.map((column) => (
                            <th
                              key={column.id}
                              className="min-w-44 px-3 py-3 text-left font-semibold"
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
                            <th className="sticky left-0 z-10 min-w-48 bg-[color:var(--tm-card)] px-3 py-3 text-left font-medium">
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
                              return (
                                <td key={column.id} className="px-3 py-2 align-middle">
                                  <CellEditor
                                    cell={cell}
                                    column={column}
                                    value={cellDisplayValue(cell, column)}
                                    saving={saving === key}
                                    onSave={(value) => updateCell(row, column, value)}
                                  />
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

    return (
      <select
        className={inputClassName("w-full")}
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
