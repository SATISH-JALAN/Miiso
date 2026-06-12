// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title ICaveatEnforcer
 * @notice Interface for MetaMask's ERC-7710 Delegation Framework caveat enforcers.
 *         A caveat enforcer is called by the DelegationManager before and after
 *         a delegated execution to validate that the action is within scope.
 *
 * @dev This interface matches the MetaMask DelegationManager's expected enforcer
 *      contract signature. See: codefi delegation-framework
 */
interface ICaveatEnforcer {
    /**
     * @notice Called BEFORE the delegated execution is forwarded to the target.
     *         Must revert if the execution is not allowed.
     *
     * @param _terms              Encoded enforcer-specific configuration terms
     * @param _mode               ERC-7579 execution mode
     * @param _executionCalldata  The raw calldata being executed on the target contract
     * @param _delegationHash     Hash of the delegation being exercised
     * @param _delegator          The user whose smart account is being acted upon
     * @param _redeemer           The agent/signer redeeming the delegation
     */
    function beforeHook(
        bytes calldata _terms,
        bytes calldata _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;

    /**
     * @notice Called AFTER the delegated execution completes.
     *         Can be used for post-execution validation or accounting.
     *
     * @param _terms              Encoded enforcer-specific configuration terms
     * @param _mode               ERC-7579 execution mode
     * @param _executionCalldata  The raw calldata that was executed
     * @param _delegationHash     Hash of the delegation that was exercised
     * @param _delegator          The user whose smart account was acted upon
     * @param _redeemer           The agent/signer who redeemed the delegation
     */
    function afterHook(
        bytes calldata _terms,
        bytes calldata _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;
}
