import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // Pinned explicitly (solc 0.8.24's implicit default is actually "cancun", not "paris")
      // so nothing here can depend on Cancun-only transient-storage opcodes, which Avalanche
      // C-Chain's support isn't confirmed for.
      evmVersion: "shanghai",
    },
  },
  networks: {
    hardhat: {},
    avalancheFuji: {
      url: process.env.AVALANCHE_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43113,
      // 25 nAVAX matches C-Chain's historical minimum base fee. (The
      // "pending"-block eth_estimateGas incompatibility some public
      // Avalanche RPC nodes have is worked around at the call site --
      // see scripts/deploy.ts's explicit gasLimit overrides -- since
      // hardhat-ethers doesn't actually wire a network-level `gas`
      // config through to skip that call.)
      gasPrice: 25_000_000_000,
    },
    avalanche: {
      url: process.env.AVALANCHE_MAINNET_RPC_URL ?? "https://api.avax.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43114,
      gasPrice: 25_000_000_000,
    },
  },
};

export default config;
