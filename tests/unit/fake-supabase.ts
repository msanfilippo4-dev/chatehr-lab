/**
 * Minimal in-memory stand-in for the parts of the Supabase query builder used by
 * lib/server/quiz-store.ts. `schema: "011"` simulates a database where migration
 * 012 has not been applied (missing columns and tables return PostgREST errors).
 */
import type { AdminClient } from "@/lib/server/course-db";

type Row = Record<string, unknown>;
type DbError = { code: string; message: string } | null;

const V2_COLUMNS = ["status", "drawn_item_ids", "option_orders", "saved_answers", "expires_at"];
const V2_TABLES = ["ehr_quiz_settings", "ehr_quiz_extensions"];

let idCounter = 0;

export class FakeDb {
  tables = new Map<string, Row[]>();
  constructor(public schema: "011" | "012" = "012") {}

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  missing(table: string, columns: string[]): DbError {
    if (this.schema === "012") return null;
    if (V2_TABLES.includes(table)) return { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` };
    if (table === "ehr_quiz_attempts") {
      const bad = columns.find((column) => V2_COLUMNS.includes(column));
      if (bad) return { code: "42703", message: `column ehr_quiz_attempts.${bad} does not exist` };
    }
    return null;
  }

  client(): AdminClient {
    return {
      from: (table: string) => new FakeQuery(this, table),
      rpc: async () => ({ data: true, error: null }),
    } as unknown as AdminClient;
  }
}

class FakeQuery {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private columns: string[] = [];
  private filters: [string, unknown][] = [];
  private payload: Row | null = null;
  private conflict: string[] = [];
  private returning = false;
  private single = false;
  private limitCount: number | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(columns = "*") {
    if (this.op === "select") this.columns = columns.split(",").map((column) => column.trim());
    else this.returning = true;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row, options: { onConflict?: string } = {}) {
    this.op = "upsert";
    this.payload = row;
    this.conflict = (options.onConflict ?? "id").split(",");
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order() {
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }

  private matches(row: Row) {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private uniqueViolation(candidate: Row, ignore?: Row): DbError {
    if (this.table !== "ehr_quiz_attempts") return null;
    for (const row of this.db.rows(this.table)) {
      if (row === ignore) continue;
      if (row.email === candidate.email && row.week === candidate.week) {
        if (row.attempt === candidate.attempt) return { code: "23505", message: "duplicate key (email, week, attempt)" };
        if (row.status === "in_progress" && candidate.status === "in_progress") return { code: "23505", message: "duplicate open attempt" };
      }
    }
    return null;
  }

  private execute(): { data: unknown; error: DbError } {
    const rows = this.db.rows(this.table);
    const touched = this.op === "select" ? this.columns : Object.keys(this.payload ?? {});
    const missing = this.db.missing(this.table, touched);
    if (missing) return { data: null, error: missing };

    if (this.op === "select") {
      let found = rows.filter((row) => this.matches(row)).map((row) => {
        if (this.columns.includes("*")) return { ...row };
        return Object.fromEntries(this.columns.map((column) => [column, row[column] ?? null]));
      });
      if (this.limitCount != null) found = found.slice(0, this.limitCount);
      return { data: this.single ? (found[0] ?? null) : found, error: null };
    }
    if (this.op === "insert") {
      const row: Row = { id: `row-${++idCounter}`, status: "submitted", submitted_at: new Date().toISOString(), ...this.payload };
      const conflict = this.uniqueViolation(row);
      if (conflict) return { data: null, error: conflict };
      rows.push(row);
      return { data: this.returning ? [row] : null, error: null };
    }
    if (this.op === "update") {
      const targets = rows.filter((row) => this.matches(row));
      for (const row of targets) Object.assign(row, this.payload);
      return { data: this.returning ? targets.map((row) => ({ id: row.id })) : null, error: null };
    }
    if (this.op === "upsert") {
      const existing = rows.find((row) => this.conflict.every((column) => row[column] === this.payload![column]));
      if (existing) Object.assign(existing, this.payload);
      else rows.push({ ...this.payload });
      return { data: null, error: null };
    }
    const keep = rows.filter((row) => !this.matches(row));
    this.db.tables.set(this.table, keep);
    return { data: null, error: null };
  }

  then<T>(resolve: (value: { data: unknown; error: DbError }) => T, reject?: (reason: unknown) => T) {
    try {
      return Promise.resolve(resolve(this.execute()));
    } catch (error) {
      return reject ? Promise.resolve(reject(error)) : Promise.reject(error);
    }
  }
}
