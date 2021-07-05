pragma solidity ^0.5.16;

import "./SErc20Delegate.sol";

interface StrkLike {
  function delegate(address delegatee) external;
}

/**
 * @title Strike's SStrkLikeDelegate Contract
 * @notice STokens which can 'delegate votes' of their underlying ERC-20
 * @author Strike
 */
contract SStrkLikeDelegate is SErc20Delegate {
  /**
   * @notice Construct an empty delegate
   */
  constructor() public SErc20Delegate() {}

  /**
   * @notice Admin call to delegate the votes of the STRK-like underlying
   * @param strkLikeDelegatee The address to delegate votes to
   */
  function _delegateStrkLikeTo(address strkLikeDelegatee) external {
    require(msg.sender == admin, "only the admin may set the strk-like delegate");
    StrkLike(underlying).delegate(strkLikeDelegatee);
  }
}