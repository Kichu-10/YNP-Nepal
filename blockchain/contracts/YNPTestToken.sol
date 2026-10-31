// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title YNP Test Token
/// @notice A fixed-supply local test token. This contract has no mint function.
contract YNPTestToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 21_000_000 ether;

    constructor() ERC20("YNP Test Token", "YNP") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
