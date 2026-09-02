import { ethers, upgrades } from "hardhat";

export interface DeployConfig {
  adminAddress: string;
  operatorAddress: string;
  feeRecipientAddress: string;
  forwarderAddress?: string;
}

export function resolveDeployConfig(env: NodeJS.ProcessEnv): DeployConfig {
  const adminAddress = env.ESCROW_ADMIN_ADDRESS;
  const operatorAddress = env.ESCROW_OPERATOR_ADDRESS;
  const feeRecipientAddress = env.ESCROW_FEE_RECIPIENT_ADDRESS;

  if (!adminAddress || !operatorAddress || !feeRecipientAddress) {
    throw new Error(
      "Set ESCROW_ADMIN_ADDRESS, ESCROW_OPERATOR_ADDRESS, ESCROW_FEE_RECIPIENT_ADDRESS env vars before deploying"
    );
  }

  return {
    adminAddress,
    operatorAddress,
    feeRecipientAddress,
    forwarderAddress: env.TRUSTED_FORWARDER_ADDRESS,
  };
}

async function main() {
  const config = resolveDeployConfig(process.env);
  // Avalanche's public C-Chain RPC nodes reject eth_estimateGas queries
  // against the "pending" block tag, which hardhat-ethers issues by
  // default whenever a transaction's gasLimit isn't already set
  // ("state not available for pending block"). Passing an explicit
  // gasLimit on every deploy call sidesteps that query entirely.
  const DEPLOY_GAS_LIMIT = 8_000_000n;
  let forwarderAddress = config.forwarderAddress;
  if (!forwarderAddress) {
    const Forwarder = await ethers.getContractFactory("ERC2771Forwarder");
    const forwarder = await Forwarder.deploy("HosEscrowForwarder", { gasLimit: DEPLOY_GAS_LIMIT });
    await forwarder.waitForDeployment();
    forwarderAddress = await forwarder.getAddress();
    console.log("Deployed new ERC2771Forwarder to:", forwarderAddress);
  } else {
    console.log("Reusing existing ERC2771Forwarder at:", forwarderAddress);
  }

  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const proxy = await upgrades.deployProxy(
    EscrowManager,
    [config.adminAddress, config.operatorAddress, config.feeRecipientAddress],
    {
      kind: "uups",
      constructorArgs: [forwarderAddress],
      unsafeAllow: ["constructor", "state-variable-immutable"],
      txOverrides: { gasLimit: DEPLOY_GAS_LIMIT },
    }
  );

  await proxy.waitForDeployment();
  console.log("EscrowManager proxy deployed to:", await proxy.getAddress());
}

// Only run main if this script is being executed directly (not imported as a module)
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
