pragma solidity ^0.5.16;

import "./SEther.sol";

/**
 * @title Strike's Maximillion Contract
 * @author Strike
 */
contract Maximillion {
    /**
     * @notice The default sEther market to repay in
     */
    SEther public sEther;

    /**
     * @notice Construct a Maximillion to repay max in a SEther market
     */
    constructor(SEther sEther_) public {
        sEther = sEther_;
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in the sEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, sEther);
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in a sEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param sEther_ The address of the sEther contract to repay in
     */
    function repayBehalfExplicit(address borrower, SEther sEther_) public payable {
        uint received = msg.value;
        uint borrows = sEther_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            sEther_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            sEther_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
