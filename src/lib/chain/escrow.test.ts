import { afterEach, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { registerEscrowBooking } from "@/lib/chain/escrow";
import { relayAsUser } from "@/lib/chain/relayer";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const OPERATOR_PRIVATE_KEY = generatePrivateKey();
const OPERATOR_ADDRESS = privateKeyToAccount(OPERATOR_PRIVATE_KEY).address;
const ORGANIZER_PRIVATE_KEY = generatePrivateKey();
const RELAYER_PRIVATE_KEY = generatePrivateKey();
const RELAYER_ADDRESS = privateKeyToAccount(RELAYER_PRIVATE_KEY).address;
const ESCROW_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const ORGANIZER_ADDRESS = privateKeyToAccount(ORGANIZER_PRIVATE_KEY).address;
const TALENT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;
// Derived (not a hardcoded literal) because signPermit's EIP-712 domain
// validation requires a genuinely well-formed, checksummed address.
const TOKEN_ADDRESS = privateKeyToAccount(generatePrivateKey()).address;
const TOKEN_NAME = "Mock USD";
const TOKEN_PERMIT_VERSION = "1";
const CHAIN_ID = 43113;

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

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
  afterEach(() => {
    delete process.env.ESCROW_MANAGER_ADDRESS;
    delete process.env.SETTLEMENT_TOKEN_PERMIT_VERSION;
  });

  function makeDepositSupabase() {
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
                    maybeSingle: async () => {
                      if (col === "user_id") {
                        return { data: { encrypted_private_key: { ciphertext: ORGANIZER_PRIVATE_KEY } }, error: null };
                      }
                      return { data: { encrypted_private_key: { ciphertext: RELAYER_PRIVATE_KEY } }, error: null };
                    },
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

  const BOOKING_ID = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(
    0,
    66
  ) as `0x${string}`;

  it("reads nonces/name, signs and submits a permit directly via the relayer wallet, then relays the deposit when allowance is insufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    process.env.SETTLEMENT_TOKEN_PERMIT_VERSION = TOKEN_PERMIT_VERSION;
    const { client, eqCalls } = makeDepositSupabase();

    const relayCalls: { to: string; data: string }[] = [];
    const relayAsUserFake = async (
      _supabase: SupabaseClient,
      _userId: string,
      to: `0x${string}`,
      data: `0x${string}`
    ) => {
      relayCalls.push({ to, data });
      return `0xdeposittx` as `0x${string}`;
    };

    const readContractCalls: { functionName: string; args: unknown[] }[] = [];
    const publicClient = {
      chain: { id: CHAIN_ID },
      readContract: async (call: { functionName: string; args: unknown[] }) => {
        readContractCalls.push(call);
        if (call.functionName === "allowance") return 0n;
        if (call.functionName === "nonces") return 5n;
        if (call.functionName === "name") return TOKEN_NAME;
        throw new Error(`unexpected readContract call: ${call.functionName}`);
      },
    };

    let permitWriteArgs: unknown;
    let permitSignerAddress: string | undefined;
    const walletClientFactory = (account: { address: `0x${string}` }) => {
      permitSignerAddress = account.address;
      return {
        writeContract: async (args: unknown) => {
          permitWriteArgs = args;
          return "0xpermittx" as const;
        },
      };
    };

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      client,
      "user-1",
      {
        bookingId: BOOKING_ID,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      {
        relayAsUser: relayAsUserFake as never,
        publicClient: publicClient as never,
        walletClientFactory: walletClientFactory as never,
        keyProvider: testKeyProvider,
      }
    );

    expect(readContractCalls.some((c) => c.functionName === "nonces" && c.args[0] === ORGANIZER_ADDRESS)).toBe(true);
    expect(readContractCalls.some((c) => c.functionName === "name")).toBe(true);

    expect(permitSignerAddress).toBe(RELAYER_ADDRESS);
    const permitArgs = (
      permitWriteArgs as {
        functionName: string;
        address: `0x${string}`;
        args: [`0x${string}`, `0x${string}`, bigint, bigint, number, `0x${string}`, `0x${string}`];
      }
    );
    expect(permitArgs.functionName).toBe("permit");
    expect(permitArgs.address).toBe(TOKEN_ADDRESS);
    const [owner, spender, value, deadline, v, r, s] = permitArgs.args;
    expect(owner).toBe(ORGANIZER_ADDRESS);
    expect(spender).toBe(ESCROW_ADDRESS);
    expect(value).toBe(100_000000n);
    expect(deadline).toBeGreaterThan(BigInt(Math.floor(Date.now() / 1000)));

    // Verify the signature genuinely authorizes the organizer as owner, for
    // this spender/value/nonce/deadline -- not just checking arg shape.
    const recoveredSigner = await recoverTypedDataAddress({
      domain: { name: TOKEN_NAME, version: TOKEN_PERMIT_VERSION, chainId: CHAIN_ID, verifyingContract: TOKEN_ADDRESS },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: { owner, spender, value, nonce: 5n, deadline },
      signature: `0x${r.slice(2)}${s.slice(2)}${v.toString(16).padStart(2, "0")}` as `0x${string}`,
    });
    expect(recoveredSigner).toBe(ORGANIZER_ADDRESS);

    expect(relayCalls).toHaveLength(1);
    expect(relayCalls[0]?.to).toBe(ESCROW_ADDRESS);
    expect(result.permitTxHash).toBe("0xpermittx");
    expect(result.depositTxHash).toBe("0xdeposittx");

    expect(eqCalls).toContainEqual(["user_id", "user-1"]);
    expect(eqCalls).toContainEqual(["label", "relayer"]);
  });

  it("skips the permit entirely when allowance is already sufficient", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    process.env.SETTLEMENT_TOKEN_PERMIT_VERSION = TOKEN_PERMIT_VERSION;

    const relayCalls: { to: string }[] = [];
    const relayAsUserFake = async (_supabase: SupabaseClient, _userId: string, to: `0x${string}`) => {
      relayCalls.push({ to });
      return `0xdeposittx` as `0x${string}`;
    };

    const readContractCalls: { functionName: string }[] = [];
    const publicClient = {
      chain: { id: CHAIN_ID },
      readContract: async (call: { functionName: string }) => {
        readContractCalls.push(call);
        if (call.functionName === "allowance") return 100_000000n;
        throw new Error(`unexpected readContract call: ${call.functionName}`);
      },
    };

    let permitWriteCalled = false;
    const walletClientFactory = () => ({
      writeContract: async () => {
        permitWriteCalled = true;
        return "0xpermittx" as const;
      },
    });

    const { depositEscrow } = await import("@/lib/chain/escrow");
    const result = await depositEscrow(
      {} as never,
      "user-1",
      {
        bookingId: BOOKING_ID,
        tokenAddress: TOKEN_ADDRESS,
        organizerAddress: ORGANIZER_ADDRESS,
        amount: 100_000000n,
      },
      {
        relayAsUser: relayAsUserFake as never,
        publicClient: publicClient as never,
        walletClientFactory: walletClientFactory as never,
        keyProvider: testKeyProvider,
      }
    );

    expect(readContractCalls.every((c) => c.functionName === "allowance")).toBe(true);
    expect(permitWriteCalled).toBe(false);
    expect(relayCalls).toHaveLength(1);
    expect(relayCalls[0]?.to).toBe(ESCROW_ADDRESS);
    expect(result.permitTxHash).toBeNull();
    expect(result.depositTxHash).toBe("0xdeposittx");
  });
});

describe("releaseEscrowToTalent", () => {
  it("relays releaseToTalent signed by the organizer", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const relayCalls: { to: string; userId: string }[] = [];
    const relayAsUserFake = async (_supabase: SupabaseClient, userId: string, to: `0x${string}`) => {
      relayCalls.push({ to, userId });
      return "0xreleasetx" as const;
    };

    const { releaseEscrowToTalent } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await releaseEscrowToTalent({} as never, "user-1", bookingId, { relayAsUser: relayAsUserFake as never });

    expect(txHash).toBe("0xreleasetx");
    expect(relayCalls).toEqual([{ to: ESCROW_ADDRESS, userId: "user-1" }]);
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});

describe("releaseEscrowAsAdmin", () => {
  it("submits releaseToTalent signed by the admin wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();
    let writeContractArgs: unknown;
    const walletClientFactory = () => ({
      writeContract: async (args: unknown) => {
        writeContractArgs = args;
        return "0xadminreleasetx" as const;
      },
    });

    const { releaseEscrowAsAdmin } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await releaseEscrowAsAdmin(client, bookingId, {
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xadminreleasetx");
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
    expect((writeContractArgs as { functionName: string }).functionName).toBe("releaseToTalent");
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});

describe("refundEscrowAsAdmin", () => {
  it("submits refundOrganizer signed by the admin wallet", async () => {
    process.env.ESCROW_MANAGER_ADDRESS = ESCROW_ADDRESS;
    const { client, eqCalls } = makeSupabase();
    let writeContractArgs: unknown;
    const walletClientFactory = () => ({
      writeContract: async (args: unknown) => {
        writeContractArgs = args;
        return "0xrefundtx" as const;
      },
    });

    const { refundEscrowAsAdmin } = await import("@/lib/chain/escrow");
    const bookingId = "0x1111111122223333444455555555555500000000000000000000000000000000".slice(0, 66) as `0x${string}`;
    const txHash = await refundEscrowAsAdmin(client, bookingId, {
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xrefundtx");
    expect(eqCalls).toEqual([["label", "admin"], ["chain", "avalanche"]]);
    expect((writeContractArgs as { functionName: string }).functionName).toBe("refundOrganizer");
    delete process.env.ESCROW_MANAGER_ADDRESS;
  });
});
