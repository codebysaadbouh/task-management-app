// Feature: task-management-app, Property 19: synchronisation offline→online

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Validates: Requirements 8.4
 *
 * Properties tested in this file:
 *   P19 – Synchronisation offline → online
 *
 * All tests run against an in-memory simulation of the SW's offline sync logic
 * (no real SW, no real IndexedDB — pure TypeScript simulation).
 */

// ---------------------------------------------------------------------------
// In-memory types
// ---------------------------------------------------------------------------

interface PendingAction {
  id: number;
  url: string;
  method: string;
  body: string | null;
  timestamp: number;
}

/** resource URL → last body received (server wins) */
type ServerState = Map<string, string | null>;

// ---------------------------------------------------------------------------
// In-memory simulation of SW offline sync logic
// ---------------------------------------------------------------------------

function simulateSavePendingAction(
  queue: PendingAction[],
  action: Omit<PendingAction, "id">
): void {
  const id = queue.length > 0 ? Math.max(...queue.map((a) => a.id)) + 1 : 1;
  queue.push({ ...action, id });
}

function simulateReplayPendingActions(
  queue: PendingAction[],
  serverState: ServerState,
  isOnline: boolean
): void {
  if (!isOnline) {
    // Network still down — leave queue unchanged
    return;
  }

  // Online: apply each action to serverState (server wins), then clear queue
  for (const action of queue) {
    serverState.set(action.url, action.body);
  }
  // Remove all replayed actions from queue
  queue.splice(0, queue.length);
}

// ---------------------------------------------------------------------------
// P19 – Synchronisation offline → online
// ---------------------------------------------------------------------------

describe("P19 – Synchronisation offline → online", () => {
  /**
   * Validates: Requirements 8.4
   *
   * Propriété 19 : Pour toute action effectuée hors ligne, après reconnexion
   * l'état serveur doit refléter ces actions (server wins).
   */
  it(
    "après reconnexion, toutes les actions en attente sont rejouées et la file est vidée",
    async () => {
      // Feature: task-management-app, Property 19: synchronisation offline→online
      /**
       * Validates: Requirements 8.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom("POST", "PATCH", "DELETE"),
              body: fc.option(fc.string(), { nil: null }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (actions) => {
            const queue: PendingAction[] = [];
            const serverState: ServerState = new Map();

            // 1. Save all actions to the queue (simulating offline)
            for (const action of actions) {
              simulateSavePendingAction(queue, {
                url: action.url,
                method: action.method,
                body: action.body,
                timestamp: Date.now(),
              });
            }

            // 2. Verify queue length equals actions length
            expect(queue).toHaveLength(actions.length);

            // 3. Replay with isOnline=true (reconnection)
            simulateReplayPendingActions(queue, serverState, true);

            // 4. Queue must now be empty
            expect(queue).toHaveLength(0);

            // 5. serverState must reflect the last action for each URL (server wins)
            // Group actions by URL and find the last one for each
            const lastActionByUrl = new Map<string, string | null>();
            for (const action of actions) {
              lastActionByUrl.set(action.url, action.body);
            }

            for (const [url, expectedBody] of lastActionByUrl) {
              expect(serverState.has(url)).toBe(true);
              expect(serverState.get(url)).toBe(expectedBody);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "lorsque hors ligne, la file reste inchangée après tentative de replay",
    async () => {
      // Feature: task-management-app, Property 19: synchronisation offline→online
      /**
       * Validates: Requirements 8.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom("POST", "PATCH", "DELETE"),
              body: fc.option(fc.string(), { nil: null }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (actions) => {
            const queue: PendingAction[] = [];
            const serverState: ServerState = new Map();

            // Save all actions to the queue (simulating offline)
            for (const action of actions) {
              simulateSavePendingAction(queue, {
                url: action.url,
                method: action.method,
                body: action.body,
                timestamp: Date.now(),
              });
            }

            const queueSnapshot = queue.map((a) => ({ ...a }));

            // Attempt replay while still offline
            simulateReplayPendingActions(queue, serverState, false);

            // Queue must remain unchanged
            expect(queue).toHaveLength(queueSnapshot.length);
            for (let i = 0; i < queue.length; i++) {
              expect(queue[i]).toEqual(queueSnapshot[i]);
            }

            // serverState must remain empty
            expect(serverState.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
