// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MiisoSuccessFeeHook
 * @author Miiso Security
 * @notice Collects the 1.5% success fee from users after a confirmed protection event.
 *
 * @dev How it works:
 *      1. During onboarding, the user approves this contract to spend up to
 *         their budget cap in USDC (e.g., approve(MiisoSuccessFeeHook, 500_000_000))
 *      2. When a revocation is confirmed via 1Shot webhook, the Miiso backend
 *         calls collectFee() with the protected value and event ID
 *      3. The contract calculates 1.5% and transfers it from the user to the treasury
 *      4. An event is emitted for on-chain audit trail
 *
 *      Fee = protectedValue × 150 / 10,000 = 1.5%
 *
 *      Safety:
 *      - Only the contract owner (Miiso backend EOA) can call collectFee
 *      - ReentrancyGuard prevents reentrancy attacks via malicious ERC-20
 *      - Each protection event can only be charged once (dedup mapping)
 *      - Maximum single fee is capped at 500 USDC to prevent bugs from over-charging
 */
contract MiisoSuccessFeeHook is Ownable, ReentrancyGuard {

    // ══════════════════════════════════════════════════════════════
    //                        STATE
    // ══════════════════════════════════════════════════════════════

    /// @notice The USDC token contract on Base
    IERC20 public immutable usdc;

    /// @notice Treasury address that receives collected fees
    address public treasury;

    /// @notice Fee rate in basis points (150 = 1.5%)
    uint256 public constant FEE_BPS = 150;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Maximum fee per single event (500 USDC = 500_000_000 in 6 decimals)
    uint256 public constant MAX_FEE_PER_EVENT = 500_000_000;

    /// @notice Tracks which protection events have already been charged (dedup)
    mapping(bytes32 => bool) public feeCollected;

    /// @notice Total fees collected lifetime (in USDC smallest units)
    uint256 public totalFeesCollected;

    // ══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ══════════════════════════════════════════════════════════════

    event SuccessFeeCollected(
        address indexed user,
        uint256 protectedValueUsdc,
        uint256 feeAmount,
        bytes32 indexed protectionEventId
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ══════════════════════════════════════════════════════════════

    error ZeroProtectedValue();
    error ZeroAddress();
    error FeeAlreadyCollected(bytes32 eventId);
    error FeeExceedsMaximum(uint256 fee, uint256 max);
    error TransferFailed();

    // ══════════════════════════════════════════════════════════════
    //                        CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @param _usdc      USDC token address on Base (Sepolia or mainnet)
     * @param _treasury  Address that receives collected success fees
     */
    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        if (_usdc == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ══════════════════════════════════════════════════════════════
    //                        CORE LOGIC
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Collects the 1.5% success fee after a confirmed protection event.
     *         Called by the Miiso backend after the 1Shot webhook confirms
     *         that the revocation transaction landed on-chain.
     *
     * @param _user                The protected user's address
     * @param _protectedValueUsdc  The value protected, in USDC 6-decimal units
     *                             e.g., $7,000 = 7_000_000_000
     * @param _protectionEventId   Unique event ID from the protection_events table
     */
    function collectFee(
        address _user,
        uint256 _protectedValueUsdc,
        bytes32 _protectionEventId
    ) external onlyOwner nonReentrant {
        // 1. Validate inputs
        if (_user == address(0)) revert ZeroAddress();
        if (_protectedValueUsdc == 0) revert ZeroProtectedValue();
        if (feeCollected[_protectionEventId]) revert FeeAlreadyCollected(_protectionEventId);

        // 2. Calculate fee: protectedValue × 150 / 10,000 = 1.5%
        uint256 fee = (_protectedValueUsdc * FEE_BPS) / BPS_DENOMINATOR;

        // 3. Cap the fee to prevent bugs from over-charging
        if (fee > MAX_FEE_PER_EVENT) revert FeeExceedsMaximum(fee, MAX_FEE_PER_EVENT);

        // 4. Mark as collected (before transfer — checks-effects-interactions)
        feeCollected[_protectionEventId] = true;
        totalFeesCollected += fee;

        // 5. Transfer USDC from user to treasury
        bool success = usdc.transferFrom(_user, treasury, fee);
        if (!success) revert TransferFailed();

        emit SuccessFeeCollected(_user, _protectedValueUsdc, fee, _protectionEventId);
    }

    // ══════════════════════════════════════════════════════════════
    //                        ADMIN
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Updates the treasury address. Only callable by the contract owner.
     * @param _newTreasury  New treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }
}
