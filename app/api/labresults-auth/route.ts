import { NextResponse } from "next/server";

const ACCESS_COOKIE = "labresults_access";
const VALID_PIN = "7116";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  if (pin !== VALID_PIN) {
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
