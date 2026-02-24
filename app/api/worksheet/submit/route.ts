import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type WorksheetPayload = {
  teamName?: string;
  selectedPatientLabel?: string;
  totalTokens?: number;
  totalCost?: number;
  notes?: Record<string, string>;
};

const STORAGE_PATH =
  process.env.WORKSHEET_STORAGE_PATH || "/tmp/chatehr_worksheet_submissions.jsonl";
const DEFAULT_NOTIFY_EMAIL = "msanfilippo4@fordham.edu";

async function appendSubmission(entry: unknown): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await mkdir(dir, { recursive: true });
  await appendFile(STORAGE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

async function forwardByEmail(entry: unknown): Promise<{ forwarded: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { forwarded: false, message: "RESEND_API_KEY not configured." };
  }

  const to = process.env.EXTRACREDIT_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL || "Fordham Worksheet <worksheet@fordms.com>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "[ChatEHR Worksheet] New student submission",
        text: JSON.stringify(entry, null, 2),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { forwarded: false, message: `Resend error (${response.status}): ${body}` };
    }
    return { forwarded: true, message: `Forwarded to ${to}` };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { forwarded: false, message: e.message || "Email forwarding failed." };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as WorksheetPayload;
    const notes = body.notes && typeof body.notes === "object" ? body.notes : {};

    const nonEmpty = Object.values(notes).filter(
      (v) => typeof v === "string" && v.trim().length > 0
    ).length;
    if (nonEmpty < 3) {
      return NextResponse.json(
        { error: "Please complete at least three worksheet fields before submitting." },
        { status: 400 }
      );
    }

    const entry = {
      id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      student: {
        name: session.user.name || "Student",
        email: session.user.email,
      },
      teamName: body.teamName?.trim() || "",
      selectedPatientLabel: body.selectedPatientLabel || "",
      totalTokens: body.totalTokens || 0,
      totalCost: body.totalCost || 0,
      notes,
    };

    await appendSubmission(entry);
    const emailStatus = await forwardByEmail(entry);

    return NextResponse.json({
      message: `Worksheet saved.${emailStatus.forwarded ? " Email sent." : ""}`,
      submissionId: entry.id,
      email: emailStatus,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to submit worksheet.", details: err.message },
      { status: 500 }
    );
  }
}

