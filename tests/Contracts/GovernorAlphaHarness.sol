pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../../contracts/Governance/GovernorAlpha.sol";

contract GovernorAlphaHarness is GovernorAlpha {
    constructor(address timelock_, address comp_, address guardian_) GovernorAlpha(timelock_, comp_, guardian_) public {}

    /// @notice The maximum number of actions that can be included in a proposal
    function proposalMaxOperations() public pure returns (uint) { return 10; } // 10 actions

    function votingPeriod() public pure returns (uint) { return 240; }
}
