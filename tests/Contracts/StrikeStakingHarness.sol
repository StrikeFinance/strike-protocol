pragma solidity ^0.5.16;

pragma experimental ABIEncoderV2;

import "../../contracts/Staking/StrikeStaking.sol";

contract StrikeStakingHarness is StrikeStaking {
    
    constructor() StrikeStaking() public {}

}
