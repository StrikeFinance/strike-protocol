pragma solidity ^0.5.16;

pragma experimental ABIEncoderV2;

import "../../contracts/Staking/StrikeStaking.sol";

contract StrikeStakingHarness is StrikeStaking {

    address public blacklistedUser;

    function setBlacklist(address account) public {
        blacklistedUser = account;
    }

    /**
     * @dev Prevents blacklisted users from calling the contract.
     */
    modifier nonBlacklist(address account) {
        require(
            account != blacklistedUser,
            "Blacklisted"
        );
        _;
    }

    modifier onlyBlacklist(address account) {
        require(
            account == blacklistedUser,
            "No blacklisted"
        );
        _;
    }

    constructor() StrikeStaking() public {}

}
