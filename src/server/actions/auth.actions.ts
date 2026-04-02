"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { registerSchema } from "@/lib/validations";
import type { User } from "@/server/db/schema/users";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function registerUser(
  input: unknown
): Promise<ActionResult<User>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Données invalides",
      code: "VALIDATION_ERROR",
    };
  }

  const { email, password } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "Un compte avec cet email existe déjà",
        code: "CONFLICT",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .$returningId();

    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return { success: true, data: created };
  } catch (error) {
    console.error("[registerUser] Unexpected error:", error);
    return {
      success: false,
      error: "Une erreur inattendue s'est produite",
      code: "INTERNAL_ERROR",
    };
  }
}
