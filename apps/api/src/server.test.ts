import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("api server", () => {
  it("returns API health", async () => {
    const app = buildServer({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok"
    });
  });

  it("requires a chat message", async () => {
    const app = buildServer({ logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "error",
      error: "message is required"
    });
  });
});
