import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dateKey: text("date_key").notNull(),
  startTime: bigint("start_time", { mode: "number" }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userGoals = pgTable("user_goals", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(1050),
  carryoverMinutes: integer("carryover_minutes").notNull().default(0),
  lastWeekKey: text("last_week_key").notNull().default(""),
});

export type User = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type UserGoals = typeof userGoals.$inferSelect;
