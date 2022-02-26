pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./PriceOracle.sol";
import "./SErc20.sol";
import "./EIP20Interface.sol";
import "./SafeMath.sol";
import "./AggregatorV2V3Interface.sol";

interface IStdReference {
    /// A structure returned whenever someone requests for standard reference data.
    struct ReferenceData {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdatedBase; // UNIX epoch of the last time when base price gets updated.
        uint256 lastUpdatedQuote; // UNIX epoch of the last time when quote price gets updated.
    }

    /// Returns the price data for the given base/quote pair. Revert if not available.
    function getReferenceData(string calldata _base, string calldata _quote) external view returns (ReferenceData memory);

    /// Similar to getReferenceData, but with multiple base/quote pairs at once.
    function getReferenceDataBulk(string[] calldata _bases, string[] calldata _quotes) external view returns (ReferenceData[] memory);
}

contract StrikeAggregatorPriceOracle is PriceOracle {
    using SafeMath for uint256;
    address public admin;

    mapping(address => uint) prices;
    mapping(bytes32 => AggregatorV2V3Interface) internal feeds;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    event NewAdmin(address oldAdmin, address newAdmin);
    event FeedSet(address feed, string symbol);

    IStdReference ref;

    constructor(IStdReference _ref) public {
        ref = _ref;
        admin = msg.sender;
    }

    function getUnderlyingPrice(SToken sToken) public view returns (uint) {
        if (compareStrings(sToken.symbol(), "sETH")) {
            if (address(getFeed(sToken.symbol())) != address(0)) {
                return getChainlinkPrice(getFeed(sToken.symbol()));
            } else {
                IStdReference.ReferenceData memory data = ref.getReferenceData("ETH", "USD");
                return data.rate;
            }
        }else if (compareStrings(sToken.symbol(), "STRK")) {
            return prices[address(sToken)];
        } else {
            uint256 price;
            EIP20Interface token = EIP20Interface(SErc20(address(sToken)).underlying());

            if(prices[address(token)] != 0) {
                price = prices[address(token)];
            } else {
                if (address(getFeed(token.symbol())) != address(0)) {
                    price = getChainlinkPrice(getFeed(token.symbol()));
                } else {
                    IStdReference.ReferenceData memory data = ref.getReferenceData(token.symbol(), "USD");
                    price = data.rate;
                }
            }

            uint256 defaultDecimal = 18;
            uint256 tokenDecimal = uint256(token.decimals());

            if(defaultDecimal == tokenDecimal) {
                return price;
            } else if(defaultDecimal > tokenDecimal) {
                return price.mul(10**(defaultDecimal.sub(tokenDecimal)));
            } else {
                return price.div(10**(tokenDecimal.sub(defaultDecimal)));
            }
        }
    }

    function setUnderlyingPrice(SToken sToken, uint underlyingPriceMantissa) public {
        require(msg.sender == admin, "only admin can set underlying price");
        address asset = address(SErc20(address(sToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        require(msg.sender == admin, "only admin can set price");
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function getChainlinkPrice(AggregatorV2V3Interface feed) internal view returns (uint) {
        // Chainlink USD-denominated feeds store answers at 8 decimals
        uint decimalDelta = uint(18).sub(feed.decimals());
        // Ensure that we don't multiply the result by 0
        if (decimalDelta > 0) {
            return uint(feed.latestAnswer()).mul(10**decimalDelta);
        } else {
            return uint(feed.latestAnswer());
        }
    }

    function setFeed(string calldata symbol, address feed) external {
        require(msg.sender == admin, "only admin can set new admin");
        require(feed != address(0) && feed != address(this), "invalid feed address");
        emit FeedSet(feed, symbol);
        feeds[keccak256(abi.encodePacked(symbol))] = AggregatorV2V3Interface(feed);
    }

    function setRef(IStdReference _ref) external {
        require(msg.sender == admin, "only admin can set new admin");
        ref = _ref;
    }

    function getFeed(string memory symbol) public view returns (AggregatorV2V3Interface) {
        return feeds[keccak256(abi.encodePacked(symbol))];
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "only admin can set new admin");
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }
}
