import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { registerEscrowBooking } from "@/lib/chain/escrow";
import { relayAsUser } from "@/lib/chain/relayer";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const OPERATOR_PRIVATE_KEY = generatePrivateKey();
const OPERATOR_ADDRESS = privateKeyToAccount(OPERATOR_PRIVATE_KEY).address;
const ESCROW_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const ORGANIZER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const TALENT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;
const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa" as const;

const testKeyProvider: KeyEncryptionProvider = {
  encrypt: async (plaintext) => ({ iv: "iv", authTag: "tag", ciphertext: plaintext, keyVersion: 1 }),
  decrypt: async (payload) => payload.ciphertext,
};

function makeSupabase() {
  const eqCalls: [string, unknown][] = [];
  const client = {
    from: (table: string) => {
      if (table !== "wallets") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (col: string, val: unknown) => {
            eqCalls.push([col, val]);
            return {
              eq: (col2: string, val2: unknown) => {
                eqCalls.push([col2, val2]);
                return {
                  maybeSingle: async () => ({
                    data: { encrypted_private_key: { ciphertext: OPERATOR_PRIVATE_KEY } },
                    error: null,
                  }),
                };
              },
            };
          },
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, eqCalls };
}

describe("registerEscrowBooking", () => {
  it("submits registerBooking signed by the operator wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();

    let writeContractArgs: unknown;
    let signerAddress: string | undefined;
    const walletClientFactory = (account: { address: `0x${string}` }) => {
      signerAddress = account.address;
      return {
        writeContract: async (args: unknown) => {
          writeContractArgs = args;
          return "0xtxhash" as const;
        },
      };
    };

    const txHash = await registerEscrowBooking(
      client,
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        organizerAddress: ORGANIZER_ADDRESS,
        talentAddress: TALENT_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        amount: 100_000000n,
        feeBps: 500,
      },
      {
        walletClientFactory: walletClientFactory as never,
        keyProvider: testKeyProvider,
      }
    );

    expect(txHash).toBe("0xtxhash");
    expect(signerAddress).toBe(OPERATOR_ADDRESS);
    expect(eqCalls).toEqual([
      ["label", "operator"],
      ["chain", "avalanche"],
    ]);

    const args = writeContractArgs as { functionName: string; args: unknown[] };
    expect(args.functionName).toBe("registerBooking");
    expect(args.args).toEqual([
      "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66),
      ORGANIZER_ADDRESS,
      TALENT_ADDRESS,
      TOKEN_ADDRESS,
      100_000000n,
      500,
    ]);

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});

describe("depositEscrow", () => {
  it("relays an approve then a deposit when allowance is insufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string; data: string }[] = [];
    const relayAsUserFake = async (
      _supabase: SupabaseClient,
      _userId: string,
      to: `0x${string}`,
      data: `0x${string}`
    ) => {
      relayCalls.push({ to, data });
      return `0xtx${relayCalls.length}` as `0x${string}`;
    };

    const publicClient = {
      readContract: async () => 0n, // allowance
    };

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      { from: () => ({}) } as never,
      "user-1",
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      { relayAsUser: relayAsUserFake as never, publicClient: publicClient as never }
    );

    expect(relayCalls).toHaveLength(2);
    expect(relayCalls[0]?.to).toBe(TOKEN_ADDRESS);
    expect(relayCalls[1]?.to).toBe(ESCROW_ADDRESS);
    expect(result.approveTxHash).toBe("0xtx1");
    expect(result.depositTxHash).toBe("0xtx2");

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });

  it("skips the approve when allowance is already sufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string }[] = [];
    const relayAsUserFake = async (_supabase: SupabaseClient, _userId: string, to: `0x${string}`) => {
      relayCalls.push({ to });
      return `0xtx${relayCalls.length}` as `0x${string}`;
    };
    const publicClient = { readContract: async () => 100_000000n };

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      {} as never,
      "user-1",
      {
        bookingId: "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      { relayAsUser: relayAsUserFake as never, publicClient: publicClient as never }
    );

    expect(relayCalls).toHaveLength(1);
    expect(relayCalls[0]?.to).toBe(ESCROW_ADDRESS);
    expect(result.approveTxHash).toBeNull();
    expect(result.depositTxHash).toBe("0xtx1");

    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});
