// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ICaveatEnforcer} from "./interfaces/ICaveatEnforcer.sol";

/**
 * @title ApprovalRevocationEnforcer
 * @author Miiso Security
 * @notice Restricts delegated execution to ONLY ERC-20 approve(spender, 0) calls.
 *         This is the on-chain safety boundary for the Miiso autonomous agent.
 *         If the agent ever attempts ANY other action, this contract reverts.
 *
 * @dev Deployed on Base Sepolia as part of MetaMask's ERC-7710 Delegation Framework.
 *
 *      Validates two things on every delegated call:
 *        1. Function selector == 0x095ea7b3 (approve(address,uint256))
 *        2. The uint256 amount argument == 0 (revocation only, never a new approval)
 *
 *      The spender address (first argument) is NOT restricted —
 *      Miiso must be able to revoke approvals to ANY malicious contract
 *      discovered during real-time scanning.
 *
 *      Security properties:
 *        - Cannot transfer tokens (selector mismatch → revert)
 *        - Cannot swap tokens (selector mismatch → revert)
 *        - Cannot set non-zero approvals (amount check → revert)
 *        - Cannot call arbitrary functions (selector check → revert)
 *        - Stateless — no storage, no owner, no upgradability, no admin
 */
contract ApprovalRevocationEnforcer is ICaveatEnforcer {

    // ══════════════════════════════════════════════════════════════
    //                        CONSTANTS
    // ══════════════════════════════════════════════════════════════

    /// @notice The function selector for ERC-20 approve(address,uint256)
    bytes4 private constant APPROVE_SELECTOR = 0x095ea7b3;

    /// @notice Minimum calldata length: 4 (selector) + 32 (address) + 32 (uint256) = 68
    uint256 private constant MIN_CALLDATA_LENGTH = 68;

    // ══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ══════════════════════════════════════════════════════════════

    /// @notice Thrown when the function selector is not approve(address,uint256)
    error InvalidSelector(bytes4 provided, bytes4 expected);

    /// @notice Thrown when the approval amount is not zero
    error NonZeroApprovalAmount(uint256 amount);

    /// @notice Thrown when calldata is too short to be a valid approve call
    error CalldataTooShort(uint256 provided, uint256 required);

    // ══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ══════════════════════════════════════════════════════════════

    /// @notice Emitted when a valid revocation is validated
    event RevocationValidated(
        address indexed delegator,
        address indexed redeemer,
        address spender,
        bytes32 delegationHash
    );

    // ══════════════════════════════════════════════════════════════
    //                        HOOKS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Called by DelegationManager BEFORE execution is forwarded.
     *         Reverts if the calldata is not a valid approve(spender, 0) call.
     *
     * @param _terms              Unused — no configuration needed for this enforcer
     * @param _mode               ERC-7579 execution mode (unused)
     * @param _executionCalldata  The raw calldata being executed on the target ERC-20
     * @param _delegationHash     Hash of the delegation being exercised
     * @param _delegator          The user whose smart account is being acted upon
     * @param _redeemer           The Miiso agent EOA redeeming the delegation
     */
    function beforeHook(
        bytes calldata _terms,
        bytes calldata _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external override {
        // ── 1. Validate calldata length ──────────────────────────
        if (_executionCalldata.length < MIN_CALLDATA_LENGTH) {
            revert CalldataTooShort(_executionCalldata.length, MIN_CALLDATA_LENGTH);
        }

        // ── 2. Extract and validate function selector ────────────
        bytes4 selector = bytes4(_executionCalldata[:4]);
        if (selector != APPROVE_SELECTOR) {
            revert InvalidSelector(selector, APPROVE_SELECTOR);
        }

        // ── 3. Extract and validate the amount argument ──────────
        // ABI encoding layout for approve(address, uint256):
        //   [0:4]   = function selector (0x095ea7b3)
        //   [4:36]  = address spender  (left-padded to 32 bytes)
        //   [36:68] = uint256 amount
        uint256 amount = abi.decode(_executionCalldata[36:68], (uint256));
        if (amount != 0) {
            revert NonZeroApprovalAmount(amount);
        }

        // ── 4. Extract spender for event logging ─────────────────
        address spender = abi.decode(_executionCalldata[4:36], (address));

        emit RevocationValidated(_delegator, _redeemer, spender, _delegationHash);
    }

    /**
     * @notice Post-execution hook — no validation needed after a revocation.
     * @dev Intentionally empty. The safety check is entirely in beforeHook.
     */
    function afterHook(
        bytes calldata _terms,
        bytes calldata _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external override {
        // No post-execution validation required for approval revocations
    }
}
