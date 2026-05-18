import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

interface IncomingSession {
  dateKey: string;
  startTime: number;
  durationSeconds: number;
  isCompleted: boolean;
  sessionType: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { sessions?: unknown };
  if (!Array.isArray(data.sessions)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const incoming: IncomingSession[] = [];
  for (const raw of data.sessions) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dateKey = typeof r.dateKey === "string" ? r.dateKey : "";
    const startTime =
      typeof r.startTime === "number" ? Math.floor(r.startTime) : NaN;
    const durationSeconds =
      typeof r.durationSeconds === "number"
        ? Math.floor(r.durationSeconds)
        : NaN;
    const isCompleted = Boolean(r.isCompleted);
    const sessionType = typeof r.sessionType === "string" && ["focus", "break", "longBreak"].includes(r.sessionType) ? r.sessionType : "focus";
    if (
      dateKey &&
      Number.isFinite(startTime) &&
      Number.isFinite(durationSeconds)
    ) {
      incoming.push({ dateKey, startTime, durationSeconds, isCompleted, sessionType });
    }
  }

  if (incoming.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const existing = await db
    .select({
      startTime: sessions.startTime,
      durationSeconds: sessions.durationSeconds,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  const seen = new Set(
    existing.map((r) => `${r.startTime}:${r.durationSeconds}`),
  );

  const toInsert = incoming.filter(
    (s) => !seen.has(`${s.startTime}:${s.durationSeconds}`),
  );

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  await db
    .insert(sessions)
    .values(toInsert.map((s) => ({ ...s, userId })));

  return NextResponse.json({ inserted: toInsert.length });
}
