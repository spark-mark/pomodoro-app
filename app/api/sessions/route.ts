import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filters = [eq(sessions.userId, session.user.id)];
  if (from) filters.push(gte(sessions.dateKey, from));
  if (to) filters.push(lte(sessions.dateKey, to));

  const rows = await db
    .select()
    .from(sessions)
    .where(and(...filters));

  return NextResponse.json({ sessions: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as {
    dateKey?: unknown;
    startTime?: unknown;
    durationSeconds?: unknown;
    isCompleted?: unknown;
  };

  const dateKey = typeof data.dateKey === "string" ? data.dateKey : "";
  const startTime =
    typeof data.startTime === "number" ? Math.floor(data.startTime) : NaN;
  const durationSeconds =
    typeof data.durationSeconds === "number"
      ? Math.floor(data.durationSeconds)
      : NaN;
  const isCompleted = Boolean(data.isCompleted);

  if (!dateKey || !Number.isFinite(startTime) || !Number.isFinite(durationSeconds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [row] = await db
    .insert(sessions)
    .values({
      userId: session.user.id,
      dateKey,
      startTime,
      durationSeconds,
      isCompleted,
    })
    .returning();

  return NextResponse.json({ session: row });
}
