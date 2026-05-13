import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ startTime: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { startTime } = await params;
  const st = parseInt(startTime, 10);
  if (!Number.isFinite(st)) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  await db
    .delete(sessions)
    .where(
      and(eq(sessions.userId, session.user.id), eq(sessions.startTime, st)),
    );

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ startTime: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { startTime } = await params;
  const st = parseInt(startTime, 10);
  if (!Number.isFinite(st)) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { durationSeconds?: unknown };
  const durationSeconds =
    typeof data.durationSeconds === "number"
      ? Math.floor(data.durationSeconds)
      : null;

  if (durationSeconds === null || !Number.isFinite(durationSeconds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await db
    .update(sessions)
    .set({ durationSeconds })
    .where(
      and(eq(sessions.userId, session.user.id), eq(sessions.startTime, st)),
    );

  return NextResponse.json({ ok: true });
}
