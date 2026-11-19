import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronAuthorized } from "../src/lib/cron/auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recap/server", () => ({ runRecap: vi.fn(async () => ({ date: "2026-11-20", rooms: 0 })) }));
// Vitest has no "@/" alias here, so route imports resolve to the real modules through these mocks.
vi.mock("@/lib/cron/auth", () => import("../src/lib/cron/auth"));
vi.mock("@/lib/api-response", () => import("../src/lib/api-response"));

const secret = "test-cron-secret-0123456789";

afterEach(() => vi.unstubAllEnvs());

describe("cron authorization", () => {
  it("accepts the exact bearer secret", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects a missing, malformed or wrong header", () => {
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized("", secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(`bearer ${secret}`, secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized("Bearer ", secret)).toBe(false);
  });

  it("rejects everything when the secret is unset or too short", () => {
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer short", "short")).toBe(false);
  });

  it("returns 401 from the cron route without the secret and runs the recap with it", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    const { GET } = await import("../src/app/api/cron/recap/route");
    const { runRecap } = await import("@/lib/recap/server");

    const denied = await GET(new Request("https://doubtroom.test/api/cron/recap"));
    expect(denied.status).toBe(401);
    expect(runRecap).not.toHaveBeenCalled();

    const allowed = await GET(new Request("https://doubtroom.test/api/cron/recap", { headers: { authorization: `Bearer ${secret}` } }));
    expect(allowed.status).toBe(200);
    expect(runRecap).toHaveBeenCalledOnce();
  });
});
