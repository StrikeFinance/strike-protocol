pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG4.sol";

contract ComptrollerScenarioG4 is ComptrollerG4 {
    uint public blockNumber;
    address public strkAddress;

    constructor() ComptrollerG4() public {}

    function setSTRKAddress(address strkAddress_) public {
        strkAddress = strkAddress_;
    }

    function getSTRKAddress() public view returns (address) {
        return strkAddress;
    }

    function membershipLength(SToken sToken) public view returns (uint) {
        return accountAssets[address(sToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    /* function getStrikeMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isStriked) {
                n++;
            }
        }

        address[] memory strikeMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isStriked) {
                strikeMarkets[k++] = address(allMarkets[i]);
            }
        }
        return strikeMarkets;
    } */

    function unlist(SToken sToken) public {
        markets[address(sToken)].isListed = false;
    }

    function setStrikeSpeed(address sToken, uint strikeSpeed) public {
        strikeSpeeds[sToken] = strikeSpeed;
    }
}
