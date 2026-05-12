import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { email?: unknown; password?: unknown };
  const email =
    typeof data.email === "string" ? data.email.toLowerCase().trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json({ id: created.id, email: created.email });
}
