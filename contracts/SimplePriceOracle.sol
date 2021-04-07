pragma solidity ^0.5.16;

import "./PriceOracle.sol";
import "./SErc20.sol";

contract SimplePriceOracle is PriceOracle {
    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);

    function getUnderlyingPrice(SToken sToken) public view returns (uint) {
        if (compareStrings(sToken.symbol(), "sETH")) {
            return 1e18;
        } else {
            return prices[address(SErc20(address(sToken)).underlying())];
        }
    }

    function setUnderlyingPrice(SToken sToken, uint underlyingPriceMantissa) public {
        address asset = address(SErc20(address(sToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    // v1 price oracle interface for use as backing of proxy
    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
