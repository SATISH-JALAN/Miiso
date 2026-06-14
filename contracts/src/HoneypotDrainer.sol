// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title HoneypotDrainer
 * @notice Intentionally vulnerable contract for Miiso Sprint 1 demo on Base Sepolia.
 *         Contains reentrancy + unrestricted delegatecall patterns for static/Venice detection.
 * @dev DO NOT deploy to mainnet. Demo / testnet only.
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract HoneypotDrainer {
    address public owner;
    mapping(address => uint256) public balances;

    event Drained(address indexed token, address indexed victim, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Classic call-before-state-update reentrancy pattern
    function drain(
        address token,
        address victim,
        address recipient,
        uint256 amount
    ) external {
        IERC20(token).transferFrom(victim, recipient, amount);
        balances[victim] = balances[victim] - amount;
        emit Drained(token, victim, amount);
    }

    /// @notice Unrestricted delegatecall — high-risk pattern for static analyzer
    function execute(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory result) = target.delegatecall(data);
        require(ok, "delegatecall failed");
        return result;
    }

    receive() external payable {}
}
