pragma solidity ^0.5.16;

import "../SafeMath.sol";

/**
 * @title Strike's Treasury Contract
 * @author Strike
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
} 

contract TeamTreasure {
    using SafeMath for uint;
    /// @notice Emitted when change owner
    event ChangeOwner(address oldOwner, address newOwner);

    /// @notice Emitted when owner withdraw amount;
    event WithdrawByOwner(address token, uint amount);

    uint public claimedAmount;
    address public owner;
    IERC20 public token;
    uint public startTimestamp;
    uint public period = 30 days;
    uint public unlockAmountPeriod = 250000000000000000000000;
    uint public maximumClaimAmount = 10000000000000000000000000;

    constructor(IERC20 _token) public {
        owner = msg.sender;
        token = _token;
        startTimestamp = block.timestamp;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NO PERMISSION");
        _;
    }

    function withdrawAllUnlockToken() public onlyOwner {
        uint unlockAmount = getUnlockedAmount();
        require(unlockAmount > 0, "INVALID AMOUNT");
        claimedAmount = claimedAmount.add(unlockAmount);
        token.transfer(owner, unlockAmount);
        emit WithdrawByOwner(address(token), unlockAmount);
    }

    function changeOwner(address newOwner) public onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit ChangeOwner(oldOwner, newOwner);
    }

    function getUnlockedAmount() view public returns (uint) {
        uint currentTime = block.timestamp;
        uint numberPeriodPass = currentTime.sub(startTimestamp).div(period);
        uint amountByPeriod = unlockAmountPeriod.mul(numberPeriodPass);
        if (amountByPeriod > maximumClaimAmount) {
            amountByPeriod = maximumClaimAmount;
        }
        uint unlockAmount = amountByPeriod.sub(claimedAmount);
        return unlockAmount;
    }

    function getLockAmount() view public returns (uint) {
        uint unlockAmount = getUnlockedAmount();
        return maximumClaimAmount.sub(unlockAmount).sub(claimedAmount);
    }

    function getOwner() view public returns (address) {
        return owner;
    }
    function getClaimedAmount() view public returns (uint) {
        return claimedAmount;
    }

}
