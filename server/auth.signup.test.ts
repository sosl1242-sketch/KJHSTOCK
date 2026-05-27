import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/supabase", async () => {
  const actual = await vi.importActual<typeof import("./_core/supabase")>("./_core/supabase");
  return {
    ...actual,
    createConfirmedEmailUser: vi.fn(),
  };
});

import { createConfirmedEmailUser } from "./_core/supabase";
import { appRouter } from "./routers";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.signUp", () => {
  beforeEach(() => {
    vi.mocked(createConfirmedEmailUser).mockReset();
  });

  it("creates a confirmed email user so signup does not require mailbox verification", async () => {
    vi.mocked(createConfirmedEmailUser).mockResolvedValue({
      id: "supabase-user-id",
      email: "new@example.com",
    });
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.auth.signUp({
      email: " New@Example.COM ",
      password: "123456",
    });

    expect(createConfirmedEmailUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "123456",
    });
    expect(result).toEqual({ success: true, email: "new@example.com" });
  });
});
