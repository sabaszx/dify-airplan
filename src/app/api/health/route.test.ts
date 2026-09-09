import { describe, it, expect } from "vitest";
import { GET as health } from "./route";
import { GET as ready } from "../ready/route";

describe("health & readiness endpoints", () => {
  it("health returns 200 with status ok", async () => {
    const res = health();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("readiness returns 200 and lists dependency checks", async () => {
    const res = ready();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks.map((c: { name: string }) => c.name)).toContain("database");
  });
});
