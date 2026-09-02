// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowManager} from "../EscrowManager.sol";

/// @notice Test-only V2 used to prove UUPS upgrades preserve existing
/// storage and the deployed proxy address, without changing production
/// EscrowManager.sol.
contract EscrowManagerV2Mock is EscrowManager {
    string public constant VERSION = "v2";

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) EscrowManager(trustedForwarder) {}
}
