function escapeCsvValue(value: unknown) {
  if (value == null) {
    return "";
  }

  const normalized = String(value);
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  headers?: string[]
) {
  if (rows.length === 0) {
    return "";
  }

  const orderedHeaders = headers ?? Object.keys(rows[0]!);
  const lines = [
    orderedHeaders.join(","),
    ...rows.map((row) =>
      orderedHeaders.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ];

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
