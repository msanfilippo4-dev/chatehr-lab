type SupabaseErrorLike =
  | {
      code?: string | null;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    }
  | null
  | undefined;

function normalizeErrorText(error: SupabaseErrorLike) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isMissingSupabaseColumnError(
  error: SupabaseErrorLike,
  table: string,
  column: string
) {
  const text = normalizeErrorText(error);
  const qualified = `${table}.${column}`.toLowerCase();

  return (
    text.includes(`column ${qualified}`) ||
    text.includes(`column '${qualified}'`) ||
    text.includes(`column "${qualified}"`) ||
    (text.includes("could not find") &&
      text.includes(table.toLowerCase()) &&
      text.includes(column.toLowerCase()))
  );
}

export function isMissingSupabaseTableError(
  error: SupabaseErrorLike,
  table: string
) {
  const text = normalizeErrorText(error);
  const qualified = `public.${table}`.toLowerCase();

  return (
    text.includes(`table '${qualified}'`) ||
    text.includes(`table "${qualified}"`) ||
    text.includes(`relation "${table.toLowerCase()}" does not exist`) ||
    text.includes(`relation "${qualified}" does not exist`) ||
    text.includes(`relation ${qualified} does not exist`)
  );
}

export function isLegacyPresetIdSchemaError(error: SupabaseErrorLike) {
  return isMissingSupabaseColumnError(error, "configurations", "preset_id");
}
