pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public strkAddress;

    constructor() Comptroller() public {}

    function setSTRKAddress(address strkAddress_) public {
        strkAddress = strkAddress_;
    }

    function getSTRKAddress() public view returns (address) {
        return strkAddress;
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

    function membershipLength(SToken sToken) public view returns (uint) {
        return accountAssets[address(sToken)].length;
    }

    function unlist(SToken sToken) public {
        markets[address(sToken)].isListed = false;
    }
}
