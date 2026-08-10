import { expect } from "chai";
import { resolveDeployConfig } from "./deploy";

describe("resolveDeployConfig", () => {
  it("throws when required env vars are missing", () => {
    expect(() => resolveDeployConfig({})).to.throw(/ESCROW_ADMIN_ADDRESS/);
  });

  it("returns the resolved config when all required env vars are present", () => {
    const config = resolveDeployConfig({
      ESCROW_ADMIN_ADDRESS: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      ESCROW_OPERATOR_ADDRESS: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      ESCROW_FEE_RECIPIENT_ADDRESS: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    } as NodeJS.ProcessEnv);
    expect(config.adminAddress).to.equal("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });
});
