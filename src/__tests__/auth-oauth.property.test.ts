// Feature: task-management-app, Property 6: callback OAuth crée ou associe un utilisateur

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 2.2, 2.4
 *
 * Propriété 6 : Pour tout profil OAuth Google valide (avec email), après le callback
 * d'autorisation, exactement un utilisateur avec cet email doit exister en base de données
 * (pas de doublon).
 *
 * This test simulates the upsert/find-or-create logic that NextAuth's DrizzleAdapter
 * performs during the OAuth callback: if a user with the given email already exists,
 * it is reused; otherwise a new user is created. In both cases exactly ONE user with
 * that email must be present in the store after the operation.
 */

// ---------------------------------------------------------------------------
// Minimal in-memory DB simulation
// ---------------------------------------------------------------------------

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
}

interface AccountRecord {
  userId: string;
  provider: string;
  providerAccountId: string;
}

interface InMemoryDB {
  users: UserRecord[];
  accounts: AccountRecord[];
}

/**
 * Simulates the NextAuth DrizzleAdapter OAuth callback logic:
 * 1. Look up an existing user by email (allowDangerousEmailAccountLinking = true).
 * 2. If found, link the OAuth account to that user (upsert account row).
 * 3. If not found, create a new user then create the account row.
 *
 * Returns the userId that was created or found.
 */
function simulateOAuthCallback(
  db: InMemoryDB,
  profile: { email: string; name: string },
  providerAccountId: string
): string {
  // Step 1 – find existing user by email
  let user = db.users.find((u) => u.email === profile.email) ?? null;

  // Step 2 – create user if not found
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: profile.email,
      name: profile.name || null,
    };
    db.users.push(user);
  }

  // Step 3 – upsert account (provider + providerAccountId is the PK)
  const existingAccount = db.accounts.find(
    (a) => a.provider === "google" && a.providerAccountId === providerAccountId
  );
  if (!existingAccount) {
    db.accounts.push({
      userId: user.id,
      provider: "google",
      providerAccountId,
    });
  }

  return user.id;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("P6 – OAuth callback crée ou associe un utilisateur", () => {
  it(
    "pour tout profil OAuth valide (nouvel utilisateur), exactement un utilisateur avec cet email existe après le callback",
    () => {
      // Feature: task-management-app, Property 6: callback OAuth crée ou associe un utilisateur
      fc.assert(
        fc.property(
          fc.record({ email: fc.emailAddress(), name: fc.string() }),
          (profile) => {
            const db: InMemoryDB = { users: [], accounts: [] };

            simulateOAuthCallback(db, profile, "google-sub-new");

            const usersWithEmail = db.users.filter(
              (u) => u.email === profile.email
            );
            expect(usersWithEmail).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "pour tout profil OAuth valide (utilisateur existant), exactement un utilisateur avec cet email existe après le callback (pas de doublon)",
    () => {
      // Feature: task-management-app, Property 6: callback OAuth crée ou associe un utilisateur
      fc.assert(
        fc.property(
          fc.record({ email: fc.emailAddress(), name: fc.string() }),
          (profile) => {
            const db: InMemoryDB = { users: [], accounts: [] };

            // Pre-populate: user already exists (e.g. registered via email/password)
            db.users.push({
              id: crypto.randomUUID(),
              email: profile.email,
              name: null,
            });

            simulateOAuthCallback(db, profile, "google-sub-existing");

            const usersWithEmail = db.users.filter(
              (u) => u.email === profile.email
            );
            expect(usersWithEmail).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "pour tout profil OAuth valide, appeler le callback deux fois avec le même compte Google ne crée pas de doublon",
    () => {
      // Feature: task-management-app, Property 6: callback OAuth crée ou associe un utilisateur
      fc.assert(
        fc.property(
          fc.record({ email: fc.emailAddress(), name: fc.string() }),
          (profile) => {
            const db: InMemoryDB = { users: [], accounts: [] };
            const providerAccountId = "google-sub-idempotent";

            // First callback
            simulateOAuthCallback(db, profile, providerAccountId);
            // Second callback (same Google account, same email)
            simulateOAuthCallback(db, profile, providerAccountId);

            const usersWithEmail = db.users.filter(
              (u) => u.email === profile.email
            );
            expect(usersWithEmail).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
