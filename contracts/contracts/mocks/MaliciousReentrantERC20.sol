// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReentrancyTarget {
    function releaseToTalent(bytes32 bookingId) external;
}

/// @notice Test-only ERC20 whose transfer hook re-enters
/// EscrowManager.releaseToTalent, used to prove the reentrancy guard works.
contract MaliciousReentrantERC20 is ERC20 {
    address public target;
    bytes32 public bookingId;
    bool public armed;

    constructor() ERC20("Malicious", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bytes32 bookingId_) external {
        target = target_;
        bookingId = bookingId_;
        armed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            IReentrancyTarget(target).releaseToTalent(bookingId);
        }
        return super.transfer(to, amount);
    }
}
