// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTController is Ownable {
    mapping(address => bool) public isWhitelistedNFT;
    mapping(address => uint256) public defaultBoostRate;
    mapping(address => mapping(uint256 => uint256)) public boostRate;

    constructor() {
    }

    function getBoostRate(address token, uint tokenId) external view returns (uint) {
        if (!isWhitelistedNFT[token]) {
            return 0;
        }

        uint256 rate = boostRate[token][tokenId];
        if (rate > 0) {
            return rate;
        }

        uint256 defaultRate = defaultBoostRate[token];

        return defaultRate;
    }

    function setWhitelist(address token, bool value) external onlyOwner {
        isWhitelistedNFT[token] = value;
    }

    function setDefaultBoostRate(address token, uint256 value) external onlyOwner {
        defaultBoostRate[token] = value;
    }

    function setBoostRate(address token, uint256 tokenId, uint256 value) external onlyOwner {
        boostRate[token][tokenId] = value;
    }
}
