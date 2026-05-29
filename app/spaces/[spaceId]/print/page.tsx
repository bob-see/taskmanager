import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { requireSpaceMember } from "@/app/api/spaces/shared";
import { prisma } from "@/app/lib/prisma";
import { PrintButton } from "./print-button";

type PrintPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ notes?: string | string[] }>;
};

const statusPrintColors: Record<string, { bg: string; border: string }> = {
  red: { bg: "#fca5a5", border: "#b91c1c" },
  amber: { bg: "#fde68a", border: "#d97706" },
  yellow: { bg: "#fde68a", border: "#d97706" },
  blue: { bg: "#bfdbfe", border: "#2563eb" },
  green: { bg: "#dcfce7", border: "#22c55e" },
  purple: { bg: "#e9d5ff", border: "#9333ea" },
  neutral: { bg: "#cbd5e1", border: "#64748b" },
  muted: { bg: "#cbd5e1", border: "#64748b" },
  gray: { bg: "#cbd5e1", border: "#64748b" },
  grey: { bg: "#cbd5e1", border: "#64748b" },
};

function statusStyle(color: string | null | undefined) {
  const key = typeof color === "string" ? color.trim().toLowerCase() : "";
  const swatch = statusPrintColors[key] ?? statusPrintColors.neutral;
  return {
    backgroundColor: swatch.bg,
    borderColor: swatch.border,
  };
}

function formatPrintedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(value);
}

function formatNoteDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || "").trim();
  if (!source) return "";
  const parts = source
    .replace(/@.*/, "")
    .split(/\s|[._-]/)
    .filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2))
    .toUpperCase();
}

function shortText(value: string | null | undefined, maxLength = 24) {
  const text = (value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function notePreview(value: string, maxLength = 120) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function isSectionRow(name: string) {
  return /^--.+--$/.test(name.trim());
}

function effectiveCellType(
  row: { cellTypeOverride: string | null },
  column: { type: string }
) {
  return row.cellTypeOverride || column.type;
}

export default async function SpacePrintPage({ params, searchParams }: PrintPageProps) {
  const { spaceId } = await params;
  const query = await searchParams;
  const notesParam = Array.isArray(query.notes) ? query.notes[0] : query.notes;
  const showFullNotes = notesParam === "full";
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <PrintAccessMessage title="Sign in required" message="Please sign in to print this space." />;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return <PrintAccessMessage title="Sign in required" message="Authenticated user not found." />;
  }

  const membership = await requireSpaceMember(spaceId, user.id);
  if (membership.error) {
    return (
      <PrintAccessMessage
        title="Space unavailable"
        message="You do not have access to this space, or it no longer exists."
      />
    );
  }

  const space = await prisma.collaborativeSpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      name: true,
      rows: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
      columns: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: {
          statusOptions: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });

  if (!space) {
    return (
      <PrintAccessMessage
        title="Space unavailable"
        message="This space could not be found."
      />
    );
  }

  const cells = await prisma.matrixCell.findMany({
    where: {
      row: { spaceId },
      column: { spaceId },
    },
    include: {
      userValue: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      noteHistory: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const cellMap = new Map(cells.map((cell) => [`${cell.rowId}:${cell.columnId}`, cell]));
  const firstStatusColumn = space.columns.find((column) => column.type === "status");
  const rowOrder = new Map(space.rows.map((row, index) => [row.id, index]));
  const columnOrder = new Map(space.columns.map((column, index) => [column.id, index]));
  const allStatusOptions = space.columns
    .filter((column) => column.type === "status")
    .flatMap((column) =>
      column.statusOptions.map((option) => ({
        ...option,
        columnName: column.name,
      }))
    );
  const statusOptions = Array.from(
    allStatusOptions
      .reduce((map, option) => {
        const key = option.label.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, option);
        return map;
      }, new Map<string, (typeof allStatusOptions)[number]>())
      .values()
  );
  const notes = cells
    .filter((cell) => cell.noteHistory.length > 0)
    .map((cell) => ({
      cell,
      row: space.rows.find((row) => row.id === cell.rowId),
      column: space.columns.find((column) => column.id === cell.columnId),
    }))
    .filter((item) => item.row && item.column)
    .sort(
      (a, b) =>
        (rowOrder.get(a.cell.rowId) ?? 0) - (rowOrder.get(b.cell.rowId) ?? 0) ||
        (columnOrder.get(a.cell.columnId) ?? 0) -
          (columnOrder.get(b.cell.columnId) ?? 0)
    );
  const noteSummary = space.columns
    .map((column) => {
      const entries = notes
        .filter((item) => item.cell.columnId === column.id)
        .flatMap((item) =>
          item.cell.noteHistory.map((note) => ({
            note,
            row: item.row,
            column: item.column,
          }))
        )
        .sort((a, b) => b.note.createdAt.getTime() - a.note.createdAt.getTime())
        .slice(0, 3);

      return { column, entries };
    })
    .filter((group) => group.entries.length > 0);

  return (
    <main className="spaces-print-page">
      <style>{printStyles}</style>
      <div className="spaces-print-toolbar">
        <PrintButton />
      </div>

      <section className="print-sheet">
        <header className="print-header">
          <div>
            <p className="print-kicker">Collaborative Space Meeting View</p>
            <h1>{space.name}</h1>
          </div>
          <div className="print-meta">
            <div>{formatPrintedAt(new Date())}</div>
            <div>
              {space.rows.length} rows · {space.columns.length} columns
            </div>
          </div>
        </header>

        {statusOptions.length > 0 ? (
          <div className="print-legend" aria-label="Status legend">
            {statusOptions.map((option) => (
              <div key={option.id} className="legend-item">
                <span className="legend-swatch" style={statusStyle(option.color)} />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <table className="print-matrix">
          <thead>
            <tr>
              <th className="row-header">Row</th>
              {space.columns.map((column) => (
                <th key={column.id}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {space.rows.map((row) => (
              <tr
                key={row.id}
                className={[
                  row.isDone ? "done-row" : "",
                  isSectionRow(row.name) ? "section-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <th className="row-header">
                  {row.name}
                  {row.isDone ? <span className="done-label">Done</span> : null}
                </th>
                {space.columns.map((column) => {
                  const cell = cellMap.get(`${row.id}:${column.id}`);
                  const type = effectiveCellType(row, column);
                  const statusColumn =
                    type === "status"
                      ? column.type === "status"
                        ? column
                        : firstStatusColumn
                      : undefined;
                  const statusOption =
                    statusColumn && cell?.statusOptionId
                      ? statusColumn.statusOptions.find(
                          (option) => option.id === cell.statusOptionId
                        )
                      : undefined;
                  return (
                    <td key={column.id}>
                      <div className="cell-content">
                        <span className="cell-value">
                          {type === "status" && statusOption ? (
                            <span
                              className="status-block"
                              style={statusStyle(statusOption.color)}
                              title={statusOption.label}
                            />
                          ) : type === "checkbox" ? (
                            cell?.booleanValue ? "✓" : ""
                          ) : type === "date" ? (
                            formatShortDate(cell?.dateValue ?? null)
                          ) : type === "number" ? (
                            cell?.numberValue === null || cell?.numberValue === undefined
                              ? ""
                              : String(cell.numberValue)
                          ) : type === "user" ? (
                            initials(cell?.userValue?.name, cell?.userValue?.email)
                          ) : (
                            shortText(cell?.textValue)
                          )}
                        </span>
                        {cell?.noteHistory.length ? <span className="note-marker">N</span> : null}
                        {cell?.userValue && column.type !== "user" ? (
                          <span className="assignment-marker">
                            {initials(cell.userValue.name, cell.userValue.email)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-notes">
        <h2>{showFullNotes ? "Notes" : "Notes Summary"}</h2>
        {notes.length === 0 ? (
          <p className="empty-notes">No notes.</p>
        ) : !showFullNotes ? (
          <div className="summary-notes-list">
            {noteSummary.map(({ column, entries }) => (
              <article key={column.id} className="summary-note-group">
                <h3>Property: {column.name}</h3>
                <ul>
                  {entries.map(({ note, row }) => (
                    <li key={note.id}>
                      <span className="summary-row-name">{row?.name}:</span>{" "}
                      <span className="summary-note-content">
                        "{notePreview(note.content)}"
                      </span>
                      <span className="summary-note-meta">
                        {" "}
                        - {note.user.name || note.user.email || "User"},{" "}
                        {formatNoteDate(note.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="notes-list">
            {notes.map(({ cell, row, column }) => (
              <article key={cell.id} className="note-group">
                <h3>
                  {row?.name} · {column?.name}
                </h3>
                {cell.noteHistory.map((note) => (
                  <div key={note.id} className="note-entry">
                    <div className="note-meta">
                      <span>{note.user.name || note.user.email || "User"}</span>
                      <span>{formatNoteDate(note.createdAt)}</span>
                    </div>
                    <p>{note.content}</p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PrintAccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="spaces-print-page access-message">
      <style>{printStyles}</style>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}

const printStyles = `
  body:has(.spaces-print-page) {
    background: #ffffff !important;
    color: #111827 !important;
  }

  body:has(.spaces-print-page) > div {
    display: block !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  body:has(.spaces-print-page) > div > aside,
  body:has(.spaces-print-page) > div > header {
    display: none !important;
  }

  body:has(.spaces-print-page) > div > div {
    min-width: 0 !important;
    padding-bottom: 0 !important;
  }

  .spaces-print-page {
    min-height: 100vh;
    background: #ffffff;
    color: #111827;
    padding: 24px;
    font-family: Arial, sans-serif;
  }

  .spaces-print-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .spaces-print-action {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #111827;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 9px 14px;
  }

  .print-sheet,
  .print-notes {
    max-width: 100%;
    margin: 0 auto;
  }

  .print-header {
    align-items: flex-start;
    border-bottom: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 10px;
    padding-bottom: 10px;
  }

  .print-kicker {
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0 0 4px;
    text-transform: uppercase;
  }

  .print-header h1 {
    font-size: 24px;
    line-height: 1.1;
    margin: 0;
  }

  .print-meta {
    color: #475569;
    flex-shrink: 0;
    font-size: 11px;
    line-height: 1.45;
    text-align: right;
  }

  .print-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 8px 0 13px;
  }

  .legend-item {
    align-items: center;
    display: inline-flex;
    font-size: 10.5px;
    font-weight: 600;
    gap: 5px;
    white-space: nowrap;
  }

  .legend-swatch,
  .status-block {
    border: 1px solid #64748b;
    display: inline-block;
    flex-shrink: 0;
  }

  .legend-swatch {
    border-radius: 999px;
    height: 10px;
    width: 10px;
  }

  .print-matrix {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
  }

  .print-matrix th,
  .print-matrix td {
    border: 1px solid #d8dee8;
    font-size: 9px;
    line-height: 1.2;
    overflow-wrap: anywhere;
    padding: 4px 4px;
    vertical-align: middle;
  }

  .print-matrix thead th {
    background: #f1f5f9;
    font-weight: 700;
  }

  .print-matrix .row-header {
    background: #f6f8fb;
    color: #0f172a;
    font-weight: 800;
    text-align: left;
    width: 38mm;
  }

  .print-matrix tbody .row-header {
    border-right-color: #cbd5e1;
  }

  .print-matrix tbody tr.section-row th,
  .print-matrix tbody tr.section-row td {
    border-top: 2px solid #cbd5e1;
    padding-top: 6px;
  }

  .print-matrix tbody tr.section-row .row-header {
    background: #eef2f7;
    color: #0f172a;
    font-size: 9.5px;
    letter-spacing: 0.02em;
  }

  .done-row {
    color: #64748b;
  }

  .done-label {
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    color: #64748b;
    display: inline-block;
    font-size: 7px;
    font-weight: 700;
    margin-left: 4px;
    padding: 1px 3px;
    text-transform: uppercase;
  }

  .cell-content {
    align-items: center;
    display: flex;
    gap: 3px;
    min-height: 15px;
  }

  .cell-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-block {
    border-radius: 3px;
    height: 10px;
    width: 16px;
  }

  .note-marker,
  .assignment-marker {
    align-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    display: inline-flex;
    flex-shrink: 0;
    font-size: 7px;
    font-weight: 700;
    height: 12px;
    justify-content: center;
    min-width: 12px;
    padding: 0 2px;
  }

  .note-marker {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
  }

  .assignment-marker {
    background: #eef2ff;
    border-color: #818cf8;
    color: #3730a3;
  }

  .print-notes {
    break-before: page;
    margin-top: 18px;
  }

  .print-notes h2 {
    border-bottom: 1px solid #d1d5db;
    font-size: 18px;
    margin: 0 0 10px;
    padding-bottom: 6px;
  }

  .summary-notes-list {
    columns: 2;
    column-gap: 14px;
  }

  .summary-note-group {
    break-inside: avoid;
    border: 1px solid #d8dee8;
    border-radius: 6px;
    display: inline-block;
    margin: 0 0 8px;
    padding: 7px;
    width: 100%;
  }

  .summary-note-group h3 {
    color: #0f172a;
    font-size: 11px;
    margin: 0 0 5px;
  }

  .summary-note-group ul {
    display: grid;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .summary-note-group li {
    break-inside: avoid;
    font-size: 9.5px;
    line-height: 1.35;
  }

  .summary-row-name {
    color: #0f172a;
    font-weight: 700;
  }

  .summary-note-content {
    color: #111827;
  }

  .summary-note-meta {
    color: #64748b;
    font-size: 8.5px;
  }

  .notes-list {
    columns: 2;
    column-gap: 14px;
  }

  .note-group {
    break-inside: avoid;
    border: 1px solid #d8dee8;
    border-radius: 6px;
    display: inline-block;
    margin: 0 0 8px;
    padding: 6px;
    width: 100%;
  }

  .note-group h3 {
    font-size: 11px;
    margin: 0 0 5px;
  }

  .note-entry {
    border-top: 1px solid #e5e7eb;
    padding-top: 5px;
  }

  .note-entry:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .note-meta {
    color: #64748b;
    display: flex;
    font-size: 8px;
    gap: 8px;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .note-entry p,
  .empty-notes,
  .access-message p {
    font-size: 10px;
    line-height: 1.35;
    margin: 0;
    white-space: pre-wrap;
  }

  .access-message {
    display: grid;
    place-content: center;
    text-align: center;
  }

  .access-message h1 {
    font-size: 24px;
    margin: 0 0 8px;
  }

  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  @media print {
    .spaces-print-page {
      min-height: auto;
      padding: 0;
    }

    .spaces-print-toolbar {
      display: none !important;
    }

    .print-matrix tr,
    .summary-note-group,
    .summary-note-group li,
    .note-group,
    .note-entry {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .print-header {
      margin-top: 0;
    }
  }
`;
