// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EscrowManager
/// @notice Holds USDT/USDC deposited by an organizer for a booking until
/// the booking resolves: released to the talent (fee deducted) or
/// refunded to the organizer.
contract EscrowManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    ERC2771ContextUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint16 public constant MAX_BPS = 10_000;

    enum State {
        None,
        Registered,
        Funded,
        Released,
        Refunded
    }

    struct Escrow {
        address organizer;
        address talent;
        address token;
        uint256 amount;
        uint16 feeBps;
        State state;
    }

    mapping(bytes32 => Escrow) public escrows;
    address public platformFeeRecipient;

    event BookingRegistered(
        bytes32 indexed bookingId,
        address indexed organizer,
        address indexed talent,
        address token,
        uint256 amount,
        uint16 feeBps
    );
    event Deposited(bytes32 indexed bookingId);
    event Released(bytes32 indexed bookingId, uint256 talentAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed bookingId, uint256 amount);
    event PlatformFeeRecipientUpdated(address indexed recipient);

    error InvalidState(bytes32 bookingId, State expected, State actual);
    error NotAuthorizedForBooking(bytes32 bookingId, address caller);
    error FeeTooHigh(uint16 feeBps);
    error ZeroAmount();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        _disableInitializers();
    }

    function initialize(address admin, address operator, address feeRecipient) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (admin == address(0) || operator == address(0) || feeRecipient == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        platformFeeRecipient = feeRecipient;
    }

    function getEscrow(bytes32 bookingId) external view returns (Escrow memory) {
        return escrows[bookingId];
    }

    function registerBooking(
        bytes32 bookingId,
        address organizer,
        address talent,
        address token,
        uint256 amount,
        uint16 feeBps
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.None) {
            revert InvalidState(bookingId, State.None, escrow.state);
        }
        if (organizer == address(0) || talent == address(0) || token == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (feeBps > MAX_BPS) {
            revert FeeTooHigh(feeBps);
        }

        escrow.organizer = organizer;
        escrow.talent = talent;
        escrow.token = token;
        escrow.amount = amount;
        escrow.feeBps = feeBps;
        escrow.state = State.Registered;

        emit BookingRegistered(bookingId, organizer, talent, token, amount, feeBps);
    }

    function deposit(bytes32 bookingId) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Registered) {
            revert InvalidState(bookingId, State.Registered, escrow.state);
        }
        if (_msgSender() != escrow.organizer) {
            revert NotAuthorizedForBooking(bookingId, _msgSender());
        }

        escrow.state = State.Funded;
        IERC20(escrow.token).safeTransferFrom(escrow.organizer, address(this), escrow.amount);

        emit Deposited(bookingId);
    }

    function releaseToTalent(bytes32 bookingId) external nonReentrant {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Funded) {
            revert InvalidState(bookingId, State.Funded, escrow.state);
        }

        address caller = _msgSender();
        if (caller != escrow.organizer && !hasRole(ADMIN_ROLE, caller)) {
            revert NotAuthorizedForBooking(bookingId, caller);
        }

        escrow.state = State.Released;

        uint256 fee = (escrow.amount * escrow.feeBps) / MAX_BPS;
        uint256 talentAmount = escrow.amount - fee;

        IERC20(escrow.token).safeTransfer(escrow.talent, talentAmount);
        if (fee > 0) {
            IERC20(escrow.token).safeTransfer(platformFeeRecipient, fee);
        }

        emit Released(bookingId, talentAmount, fee);
    }

    function refundOrganizer(bytes32 bookingId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Escrow storage escrow = escrows[bookingId];
        if (escrow.state != State.Funded) {
            revert InvalidState(bookingId, State.Funded, escrow.state);
        }

        escrow.state = State.Refunded;

        IERC20(escrow.token).safeTransfer(escrow.organizer, escrow.amount);

        emit Refunded(bookingId, escrow.amount);
    }

    function setPlatformFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        platformFeeRecipient = recipient;
        emit PlatformFeeRecipientUpdated(recipient);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }

    function _contextSuffixLength() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }
}
