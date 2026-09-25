/** Small stroke icons (24-unit grid) used in the navigation rail and headers. */
const PATHS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  chart: "M7 3.5h7l4 4V20.5H7zM14 3.5V8h4M9.5 12h6M9.5 15.5h6",
  inbox: "M3.5 13.5 6 5h12l2.5 8.5v5h-17zM3.5 13.5H9l1 2h4l1-2h5.5",
  pill: "M8.5 15.5 15.5 8.5a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5zM12 12l3.5 3.5",
  pulse: "M3 12h4l2-5 4 10 2-5h6",
  note: "M5 4.5h11l3 3V19.5H5zM8 10h8M8 13.5h8M8 17h5",
  flask: "M9.5 3.5h5M10.5 3.5V9L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L13.5 9V3.5M7.5 14.5h9",
  message: "M4 5.5h16v10H9l-5 4z",
  calendar: "M4.5 6h15v13.5h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4",
  idcard: "M3.5 6h17v12h-17zM7 10.5h4M7 14h6M15.5 10.5h2M15.5 14h2",
  merge: "M6 4v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v3M18 4v5M6 20v-3",
  exchange: "M4 8h13l-3-3M20 16H7l3 3",
  shield: "M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z",
  dollar: "M12 3.5v17M16 7.5c-.5-1.5-2-2.5-4-2.5-2.5 0-4 1.3-4 3s1.5 2.5 4 3 4 1.5 4 3.2-1.7 3.3-4 3.3c-2 0-3.5-1-4-2.5",
  bars: "M5 19.5V11M10 19.5V5M15 19.5v-6M20 19.5V8",
  query: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5l5 5",
  ticket: "M3.5 7.5h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4zM14 7.5v10",
  spark: "M12 3.5 13.8 9l5.7 1.5-5.7 1.7L12 18l-1.8-5.8-5.7-1.7L10.2 9z",
  rocket: "M12 15.5 8.5 12c1-4 3.5-7.5 8-8.5-1 4.5-4.5 7-8 8M8.5 12 5 13l1.5-4 3-.5M12 15.5 11 19l4-1.5.5-3",
  book: "M4.5 5c3-1 5.5-.5 7.5 1 2-1.5 4.5-2 7.5-1v14c-3-1-5.5-.5-7.5 1-2-1.5-4.5-2-7.5-1zM12 6v14",
  check: "M4.5 12.5 9.5 17.5 19.5 6.5",
  grade: "M5 4.5h14v15H5zM8.5 9h7M8.5 12.5h7M8.5 16h4",
  gear: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M18 6l-1.8 1.8M7.8 16.2 6 18",
  search: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5l5 5",
  menu: "M4 7h16M4 12h16M4 17h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zM12 7.5V12l3 2",
  alert: "M12 4 21 19.5H3zM12 10v4.5M12 17v.5",
  scan: "M4 8V4.5h3.5M16.5 4.5H20V8M20 16v3.5h-3.5M7.5 19.5H4V16M8 8v8M11 8v8M14 8v8M16.5 8v8",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5",
  lightbulb: "M9 18h6M10 21h4M12 3.5a6 6 0 0 0-3.5 10.9V16h7v-1.6A6 6 0 0 0 12 3.5z",
};

export const VIEW_ICONS: Record<string, string> = {
  Worklist: "home",
  Patients: "chart",
  "In Basket": "inbox",
  eMAR: "pill",
  Flowsheets: "pulse",
  Encounter: "note",
  "Orders & Results": "flask",
  Portal: "message",
  Schedule: "calendar",
  Registration: "idcard",
  MPI: "merge",
  HIE: "exchange",
  "Audit Review": "shield",
  Billing: "dollar",
  Analytics: "bars",
  "Query Studio": "query",
  Tickets: "ticket",
  "AI Review": "spark",
  Implementation: "rocket",
  Assignments: "book",
  Quizzes: "check",
  Gradebook: "grade",
  Admin: "gear",
};

export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  const d = PATHS[name] ?? PATHS.chart;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
