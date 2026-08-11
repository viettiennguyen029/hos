import { describe, expect, it, mock } from "bun:test";

describe("isCurrentUserAdmin", () => {
  it("returns false when not signed in", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it("returns false when signed in but not in admin_users", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it("returns true when the user has an admin_users row", async () => {
    mock.module("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "user-1" }, error: null }) }) }),
        }),
      }),
    }));
    const { isCurrentUserAdmin } = await import("@/lib/supabase/admin");
    expect(await isCurrentUserAdmin()).toBe(true);
  });
});
