type MiddlewareFilterValue = string | number | boolean;

export function buildFilterByFromMiddlewareResponse(
  filters: Record<string, unknown> | undefined,
): string | undefined {
  if (filters == null) {
    return undefined;
  }

  const clauses = Object.entries(filters)
    .map(([fieldName, fieldValues]) =>
      buildFieldClause(fieldName, fieldValues as unknown[]),
    )
    .filter((clause): clause is string => clause !== undefined);

  if (clauses.length === 0) {
    return undefined;
  }

  return clauses.join(" && ");
}

export function mergeFilterByClauses(
  existingFilterBy: unknown,
  middlewareFilterBy: string | undefined,
): string | undefined {
  const existing = sanitizeClause(existingFilterBy);
  const middleware = sanitizeClause(middlewareFilterBy);

  if (existing == null) return middleware;
  if (middleware == null) return existing;
  return `(${existing}) && (${middleware})`;
}

function buildFieldClause(
  fieldName: string,
  fieldValues: unknown[],
): string | undefined {
  if (
    typeof fieldName !== "string" ||
    fieldName.trim() === "" ||
    !Array.isArray(fieldValues)
  ) {
    return undefined;
  }

  const serializedValues = fieldValues
    .map(serializeFilterValue)
    .filter((value): value is string => value !== undefined);

  if (serializedValues.length === 0) {
    return undefined;
  }

  return `${fieldName}:=[${serializedValues.join(",")}]`;
}

function serializeFilterValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return `\`${escapeForFilterValue(value)}\``;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function escapeForFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

function sanitizeClause(clause: unknown): string | undefined {
  if (typeof clause !== "string") {
    return undefined;
  }

  const trimmedClause = clause.trim();
  return trimmedClause.length === 0 ? undefined : trimmedClause;
}
