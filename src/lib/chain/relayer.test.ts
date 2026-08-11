import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { relayAsUser } from "@/lib/chain/relayer";
import type { KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const USER_PRIVATE_KEY = generatePrivateKey();
const USER_ADDRESS = privateKeyToAccount(USER_PRIVATE_KEY).address;
const RELAYER_PRIVATE_KEY = generatePrivateKey();
const RELAYER_ADDRESS = privateKeyToAccount(RELAYER_PRIVATE_KEY).address;
const TO_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const FORWARDER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

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
                  maybeSingle: async () => {
                    if (col === "user_id") {
                      return { data: { encrypted_private_key: { ciphertext: USER_PRIVATE_KEY } }, error: null };
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

describe("relayAsUser", () => {
  it("signs with the user's account, submits with the relayer's account, and returns the tx hash", async () => {
    const { client } = makeSupabase();

    process.env.FORWARDER_ADDRESS = FORWARDER_ADDRESS;

    let readContractArgs: unknown;
    const publicClient = {
      chain: { id: 43113 },
      readContract: async (args: unknown) => {
        readContractArgs = args;
        return 0n; // nonce
      },
    };

    let writeContractArgs: unknown;
    let writeContractSignerAddress: string | undefined;
    const walletClientFactory = (account: LocalAccount) => {
      writeContractSignerAddress = account.address;
      return {
        writeContract: async (args: unknown) => {
          writeContractArgs = args;
          return "0xtxhash" as const;
        },
      };
    };

    const txHash = await relayAsUser(client, "user-1", TO_ADDRESS, "0xabcdef", {
      publicClient: publicClient as never,
      walletClientFactory: walletClientFactory as never,
      keyProvider: testKeyProvider,
    });

    expect(txHash).toBe("0xtxhash");
    expect(writeContractSignerAddress).toBe(RELAYER_ADDRESS);
    expect((readContractArgs as { args: string[] }).args).toEqual([USER_ADDRESS]);

    const request = (writeContractArgs as { args: [{ from: string; to: string; data: string; signature: string; value: bigint; gas: bigint; deadline: number }] }).args[0];
    expect(request.from).toBe(USER_ADDRESS);
    expect(request.to).toBe(TO_ADDRESS);
    expect(request.data).toBe("0xabcdef");
    expect(request.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

    // Verify the signature was actually signed by the user, not just checking shape
    const recoveredSigner = await recoverTypedDataAddress({
      domain: { name: "HosEscrowForwarder", version: "1", chainId: 43113, verifyingContract: FORWARDER_ADDRESS },
      types: {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      },
      primaryType: "ForwardRequest",
      message: { from: request.from, to: request.to, value: request.value, gas: request.gas, nonce: 0n, deadline: request.deadline, data: request.data },
      signature: request.signature,
    });
    expect(recoveredSigner).toBe(USER_ADDRESS);

    delete process.env.FORWARDER_ADDRESS;
  });
});
