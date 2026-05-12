import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { userGoals } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(userGoals)
    .where(eq(userGoals.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ goals: row ?? null });
}

export async function PUT(req: Request) {
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

  const data = body as {
    weeklyGoalMinutes?: unknown;
    carryoverMinutes?: unknown;
    lastWeekKey?: unknown;
  };

  const weeklyGoalMinutes =
    typeof data.weeklyGoalMinutes === "number"
      ? Math.floor(data.weeklyGoalMinutes)
      : 1050;
  const carryoverMinutes =
    typeof data.carryoverMinutes === "number"
      ? Math.floor(data.carryoverMinutes)
      : 0;
  const lastWeekKey =
    typeof data.lastWeekKey === "string" ? data.lastWeekKey : "";

  const values = {
    userId,
    weeklyGoalMinutes,
    carryoverMinutes,
    lastWeekKey,
  };

  const [row] = await db
    .insert(userGoals)
    .values(values)
    .onConflictDoUpdate({
      target: userGoals.userId,
      set: {
        weeklyGoalMinutes,
        carryoverMinutes,
        lastWeekKey,
      },
    })
    .returning();

  return NextResponse.json({ goals: row });
}
