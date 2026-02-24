import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";

const ACCESS_COOKIE = "labresults_access";
const DEV_FALLBACK_PIN = "7116";

function getValidPin(): string {
  const configured = (process.env.LAB_RESULTS_PIN || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_PIN;
  return "";
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: Request) {
  const validPin = getValidPin();
  if (!validPin) {
    return NextResponse.json(
      {
        error:
          "LAB_RESULTS_PIN is not configured in production. Set it in environment variables.",
      },
      { status: 500 }
    );
  }

  const parsed = await readJsonBodyWithLimit<{ pin?: unknown }>(req, 8_000);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const pin = trimString(parsed.data.pin, 16);

  if (!constantTimeEquals(pin, validPin)) {
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/results",
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/results",
    maxAge: 0,
  });
  return res;
}
