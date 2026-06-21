export function isMissingDatabaseObjectError(
  error: unknown,
  objectName: string,
  codes: string[] = ["P2021", "P2022"]
) {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { column?: unknown; table?: unknown };
  };
  const errorText = [
    candidate.message,
    candidate.meta?.column,
    candidate.meta?.table,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    typeof candidate.code === "string" &&
    codes.includes(candidate.code) &&
    errorText.toLocaleLowerCase().includes(objectName.toLocaleLowerCase())
  );
}
