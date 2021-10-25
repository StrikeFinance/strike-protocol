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

    function setStrikeBorrowerIndex(address sToken, address borrower, uint index) public {
        strikeBorrowerIndex[sToken][borrower] = index;
    }

    function setStrikeSupplierIndex(address sToken, address supplier, uint index) public {
        strikeSupplierIndex[sToken][supplier] = index;
    }

    function refreshStrikeSpeeds() public {
        SToken[] memory allMarkets_ = allMarkets;
        for (uint i = 0; i < allMarkets_.length; i++) {
            SToken sToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: sToken.borrowIndex()});
            updateStrikeSupplyIndex(address(sToken));
            updateStrikeBorrowIndex(address(sToken), borrowIndex);
        }
        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            SToken sToken = allMarkets_[i];
            if (strikeSupplySpeeds[address(sToken)] > 0 || strikeBorrowSpeeds[address(sToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(sToken)});
                Exp memory utility = mul_(assetPrice, sToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }
        for (uint i = 0; i < allMarkets_.length; i++) {
            SToken sToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(strikeRate, div_(utilities[i], totalUtility)) : 0;
            setStrikeSpeedInternal(sToken, newSpeed, newSpeed);
        }
    }
}
