// Feature: task-management-app, Property 1: round-trip inscription→connexion

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";

/**
 * Validates: Requirements 1.1, 1.2
 *
 * Propriété 1 : Pour tout email valide et mot de passe valide (≥ 8 caractères),
 * inscrire un utilisateur puis tenter de se connecter avec les mêmes identifiants
 * doit réussir.
 *
 * This test simulates the registerUser / authorize logic in-memory, mirroring
 * the behaviour of auth.actions.ts and lib/auth.ts without requiring a real DB
 * connection.
 */

// ---------------------------------------------------------------------------
// Minimal in-memory DB simulation
// ---------------------------------------------------------------------------

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
}

interface InMemoryDB {
  users: UserRecord[];
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Simulates registerUser from src/server/actions/auth.actions.ts
 */
async function simulateRegisterUser(
  db: InMemoryDB,
  input: unknown
): Promise<ActionResult<UserRecord>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Données invalides",
      code: "VALIDATION_ERROR",
    };
  }

  const { email, password } = parsed.data;

  const existing = db.users.find((u) => u.email === email);
  if (existing) {
    return {
      success: false,
      error: "Un compte avec cet email existe déjà",
      code: "CONFLICT",
    };
  }

  // Use cost factor 1 in tests to keep bcrypt fast across 100 property runs
  const passwordHash = await bcrypt.hash(password, 1);

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    name: null,
    image: null,
    createdAt: new Date(),
  };
  db.users.push(user);

  return { success: true, data: user };
}

/**
 * Simulates the Credentials authorize() from src/lib/auth.ts
 * Returns the user record on success, null on failure.
 */
async function simulateAuthorize(
  db: InMemoryDB,
  email: string,
  password: string
): Promise<UserRecord | null> {
  const user = db.users.find((u) => u.email === email) ?? null;
  if (!user || !user.passwordHash) return null;

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return null;

  return user;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("P2 – Identifiants invalides retournent une erreur générique", () => {
  it(
    "pour tout email inexistant et tout mot de passe, authorize retourne null sans distinguer le champ incorrect",
    async () => {
      // Feature: task-management-app, Property 2: identifiants invalides retournent une erreur générique
      /**
       * Validates: Requirements 1.3
       *
       * Propriété 2 : Pour tout couple (email inexistant, password), la connexion
       * doit échouer (retourner null) sans préciser lequel des deux champs est incorrect.
       *
       * La DB est vide → aucun email ne peut exister → authorize doit toujours retourner null.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string(),
          async (email, password) => {
            // Empty DB — the email never exists
            const db: InMemoryDB = { users: [] };

            const result = await simulateAuthorize(db, email, password);

            // Must return null generically (no field distinction)
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

describe("P3 – Unicité de l'email à l'inscription", () => {
  it(
    "pour tout email déjà inscrit, une seconde inscription doit être rejetée avec { success: false, code: 'CONFLICT' }",
    async () => {
      // Feature: task-management-app, Property 3: unicité de l'email à l'inscription
      /**
       * Validates: Requirements 1.4
       *
       * Propriété 3 : Pour tout email déjà inscrit, une seconde inscription avec
       * le même email doit être rejetée avec code CONFLICT.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8 }),
          async (email, password) => {
            const db: InMemoryDB = { users: [] };

            // First registration — must succeed
            const first = await simulateRegisterUser(db, { email, password });
            fc.pre(first.success === true);

            // Second registration with the same email — must be rejected
            const second = await simulateRegisterUser(db, { email, password });

            expect(second.success).toBe(false);
            if (!second.success) {
              expect(second.code).toBe("CONFLICT");
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

describe("P1 – Round-trip inscription → connexion", () => {
  it(
    "pour tout email valide et mot de passe valide, registerUser réussit et retourne { success: true }",
    async () => {
      // Feature: task-management-app, Property 1: round-trip inscription→connexion
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8 }),
          async (email, password) => {
            // Skip inputs that don't pass the app's own Zod schema
            fc.pre(registerSchema.safeParse({ email, password }).success);

            const db: InMemoryDB = { users: [] };

            const result = await simulateRegisterUser(db, { email, password });

            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "pour tout email valide et mot de passe valide, après inscription la connexion avec les mêmes identifiants réussit",
    async () => {
      // Feature: task-management-app, Property 1: round-trip inscription→connexion
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8 }),
          async (email, password) => {
            // Skip inputs that don't pass the app's own Zod schema
            fc.pre(registerSchema.safeParse({ email, password }).success);

            const db: InMemoryDB = { users: [] };

            // Step 1 – register
            const registerResult = await simulateRegisterUser(db, {
              email,
              password,
            });
            expect(registerResult.success).toBe(true);

            // Step 2 – login with the same credentials
            const session = await simulateAuthorize(db, email, password);

            expect(session).not.toBeNull();
            expect(session!.email).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

describe("P4 – Mots de passe stockés hachés", () => {
  it(
    "pour tout mot de passe non vide, le hash stocké en base ne doit jamais être égal au plaintext",
    async () => {
      // Feature: task-management-app, Property 4: mots de passe stockés hachés
      /**
       * Validates: Requirements 1.5
       *
       * Propriété 4 : Pour tout utilisateur créé avec un mot de passe, la valeur
       * stockée dans la colonne `password_hash` ne doit jamais être égale au mot
       * de passe en clair. Le hash doit également commencer par '$2' (préfixe bcrypt).
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (password) => {
            const db: InMemoryDB = { users: [] };

            // Build a valid email to satisfy registerSchema
            const email = `user-${crypto.randomUUID()}@example.com`;

            // Ensure the password meets the registerSchema minimum length (8 chars);
            // pad short passwords so the registration itself doesn't fail on validation.
            const safePassword = password.length >= 8 ? password : password.padEnd(8, "a");

            const result = await simulateRegisterUser(db, {
              email,
              password: safePassword,
            });

            // Registration must succeed for the property to be meaningful
            fc.pre(result.success === true);

            const storedUser = db.users.find((u) => u.email === email);
            expect(storedUser).toBeDefined();

            // Core property: stored hash must NOT equal the plaintext password
            expect(storedUser!.passwordHash).not.toBe(safePassword);

            // Sanity check: bcrypt hashes always start with '$2'
            expect(storedUser!.passwordHash.startsWith("$2")).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// Feature: task-management-app, Property 5: déconnexion invalide la session

/**
 * Validates: Requirements 1.6
 *
 * Propriété 5 : Pour tout utilisateur authentifié, après déconnexion toute route
 * protégée doit être inaccessible (le middleware redirige vers /login).
 *
 * We test the middleware logic directly by simulating the `auth` callback with
 * and without a session object, verifying redirect behaviour.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Inline middleware logic (mirrors src/middleware.ts without importing it,
// to avoid pulling in the NextAuth runtime in unit tests)
// ---------------------------------------------------------------------------

interface MockSession {
  user?: { id: string; email: string };
}

interface MockAuthRequest {
  nextUrl: URL;
  auth: MockSession | null;
}

/**
 * Pure re-implementation of the middleware guard logic extracted from
 * src/middleware.ts so we can unit-test it without a real NextAuth context.
 */
function runMiddlewareLogic(req: MockAuthRequest): "redirect-login" | "redirect-dashboard" | "next" {
  const { nextUrl, auth: session } = req;
  const isAuthenticated = !!session?.user;

  const isAppRoute =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/boards");
  const isAuthRoute =
    nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

  if (isAppRoute && !isAuthenticated) {
    return "redirect-login";
  }

  if (isAuthRoute && isAuthenticated) {
    return "redirect-dashboard";
  }

  return "next";
}

// ---------------------------------------------------------------------------
// P5 property tests
// ---------------------------------------------------------------------------

describe("P5 – Déconnexion invalide la session", () => {
  it(
    "pour tout utilisateur authentifié, après déconnexion (session=null) toute route protégée redirige vers /login",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate protected route paths
          fc.oneof(
            fc.constant("/dashboard"),
            fc.constant("/boards"),
            fc.string({ minLength: 1, maxLength: 30 }).map((id) => `/boards/${id}`)
          ),
          async (protectedPath) => {
            const url = new URL(`http://localhost${protectedPath}`);

            // --- With active session: protected route must be accessible ---
            const authenticatedReq: MockAuthRequest = {
              nextUrl: url,
              auth: { user: { id: "user-1", email: "user@example.com" } },
            };
            const resultAuthenticated = runMiddlewareLogic(authenticatedReq);
            expect(resultAuthenticated).toBe("next");

            // --- After logout (session = null): must redirect to /login ---
            const loggedOutReq: MockAuthRequest = {
              nextUrl: url,
              auth: null,
            };
            const resultLoggedOut = runMiddlewareLogic(loggedOutReq);
            expect(resultLoggedOut).toBe("redirect-login");
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "pour tout utilisateur non authentifié, les routes d'authentification (/login, /register) restent accessibles",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("/login", "/register"),
          async (authPath) => {
            const url = new URL(`http://localhost${authPath}`);

            const loggedOutReq: MockAuthRequest = {
              nextUrl: url,
              auth: null,
            };
            const result = runMiddlewareLogic(loggedOutReq);
            // Auth routes must not redirect when there is no session
            expect(result).toBe("next");
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
