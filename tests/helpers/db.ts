import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { users, type UserRole } from "@/lib/db/schema";

/** Base SQLite en mémoire, migrée, isolée pour chaque test. */
export async function createTestDb() {
  const connection = await createDatabase("file::memory:");
  await migrate(connection.db, { migrationsFolder: "./drizzle" });
  return connection;
}

export async function insertUser(
  db: Awaited<ReturnType<typeof createTestDb>>["db"],
  overrides: Partial<{ email: string; password: string; role: UserRole; isActive: boolean }> = {},
) {
  const password = overrides.password ?? "motdepasse-test-123";
  const [user] = await db
    .insert(users)
    .values({
      name: "Utilisateur Test",
      email: overrides.email ?? "test@exemple.test",
      passwordHash: await hashPassword(password),
      role: overrides.role ?? "employee",
      isActive: overrides.isActive ?? true,
    })
    .returning();
  return { user: user!, password };
}
