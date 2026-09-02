import { afterEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

const checkPlatformWalletBalances = mock(
  async () => [
    { label: "relayer", address: "0xrelayer", balanceWei: 10n ** 17n, belowThreshold: false },
  ]
);
mock.module("@/lib/wallet/check-balances", () => ({ checkPlatformWalletBalances }));
mock.module("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));

describe("GET /api/cron/check-relayer-balance", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    checkPlatformWalletBalances.mockClear();
    delete process.env.CRON_SECRET;

    const { GET } = await import("@/app/api/cron/check-relayer-balance/route");
    const request = new NextRequest("http://localhost/api/cron/check-relayer-balance", {
      headers: { authorization: "Bearer secret" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(checkPlatformWalletBalances).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    checkPlatformWalletBalances.mockClear();
    process.env.CRON_SECRET = "test-secret";

    const { GET } = await import("@/app/api/cron/check-relayer-balance/route");
    const request = new NextRequest("http://localhost/api/cron/check-relayer-balance");

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(checkPlatformWalletBalances).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not match Bearer token", async () => {
    checkPlatformWalletBalances.mockClear();
    process.env.CRON_SECRET = "test-secret";

    const { GET } = await import("@/app/api/cron/check-relayer-balance/route");
    const request = new NextRequest("http://localhost/api/cron/check-relayer-balance", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(checkPlatformWalletBalances).not.toHaveBeenCalled();
  });

  it("returns 200 and calls checkPlatformWalletBalances when authorization is valid and no wallets below threshold", async () => {
    checkPlatformWalletBalances.mockClear();
    checkPlatformWalletBalances.mockImplementationOnce(async () => [
      { label: "relayer", address: "0xrelayer", balanceWei: 10n ** 17n, belowThreshold: false },
      { label: "operator", address: "0xoperator", balanceWei: 10n ** 18n, belowThreshold: false },
    ]);
    process.env.CRON_SECRET = "test-secret";

    const { GET } = await import("@/app/api/cron/check-relayer-balance/route");
    const request = new NextRequest("http://localhost/api/cron/check-relayer-balance", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.anyLow).toBe(false);
    expect(data.results).toHaveLength(2);
    expect(checkPlatformWalletBalances).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and calls checkPlatformWalletBalances when authorization is valid and a wallet is below threshold", async () => {
    checkPlatformWalletBalances.mockClear();
    checkPlatformWalletBalances.mockImplementationOnce(async () => [
      { label: "relayer", address: "0xrelayer", balanceWei: 1n, belowThreshold: true },
      { label: "operator", address: "0xoperator", balanceWei: 10n ** 18n, belowThreshold: false },
    ]);
    process.env.CRON_SECRET = "test-secret";

    const { GET } = await import("@/app/api/cron/check-relayer-balance/route");
    const request = new NextRequest("http://localhost/api/cron/check-relayer-balance", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.anyLow).toBe(true);
    expect(data.results).toHaveLength(2);
    expect(data.results[0]?.balanceWei).toBe("1");
    expect(checkPlatformWalletBalances).toHaveBeenCalledTimes(1);
  });
});
