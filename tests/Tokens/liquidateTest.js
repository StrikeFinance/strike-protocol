const { default: BigNumber } = require('bignumber.js');
const {
  etherGasCost,
  etherMantissa,
  etherExp,
} = require('../Utils/Ethereum');

const {
  makeSToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/Strike');

const repayAmount = etherExp(10);
const seizeTokens = repayAmount.mul(4); // forced

async function preLiquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral) {
  // setup for success in liquidating
  await send(sToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(sToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(sToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(sToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(sToken.comptroller, 'setSeizeAllowed', [true]);
  await send(sToken.comptroller, 'setSeizeVerify', [true]);
  await send(sToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await send(sTokenCollateral, 'harnessSetTotalSupply', [etherExp(10)]);
  await setBalance(sTokenCollateral, liquidator, 0);
  await setBalance(sTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(sTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(sToken, borrower, 1, 1, repayAmount);
  await preApprove(sToken, liquidator, repayAmount);
}

async function liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral) {
  return send(sToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, sTokenCollateral._address]);
}

async function liquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(sToken, 1);
  await fastForward(sTokenCollateral, 1);
  return send(sToken, 'liquidateBorrow', [borrower, repayAmount, sTokenCollateral._address], {from: liquidator});
}

async function seize(sToken, liquidator, borrower, seizeAmount) {
  return send(sToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('SToken', function () {
  let root, liquidator, borrower, accounts;
  let sToken, sTokenCollateral;

  const protocolSeizeShareMantissa =  etherMantissa(5,1e16); // 5%
  const exchangeRate = etherExp(.2);

  const protocolShareTokens = seizeTokens.div(etherExp(1)).mul(protocolSeizeShareMantissa);
  const liquidatorShareTokens = seizeTokens.sub(protocolShareTokens);

  const addReservesAmount = protocolShareTokens.mul(exchangeRate).div(etherExp(1));

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    sToken = await makeSToken({comptrollerOpts: {kind: 'bool'}});
    sTokenCollateral = await makeSToken({comptroller: sToken.comptroller});
    expect(await send(sTokenCollateral, 'harnessSetExchangeRate', [exchangeRate])).toSucceed();
  });

  beforeEach(async () => {
    await preLiquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(sToken.comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(sToken);
      expect(
        await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(sToken);
      await fastForward(sTokenCollateral);
      await send(sToken, 'accrueInterest');
      expect(
        await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(sToken, borrower, borrower, repayAmount, sTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(sToken, liquidator, borrower, 0, sTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      await send(sToken.comptroller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(sToken.comptroller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(sToken.comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("reverts if liquidateBorrowVerify fails", async() => {
      await send(sToken.comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(sToken, liquidator, borrower, repayAmount, sTokenCollateral);
      const afterBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        sTokenCollateral: sTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: sToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: liquidatorShareTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 2], {
        from: borrower,
        to: sTokenCollateral._address,
        amount: protocolShareTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [sToken, 'cash', repayAmount],
        [sToken, 'borrows', -repayAmount],
        [sToken, liquidator, 'cash', -repayAmount],
        [sTokenCollateral, liquidator, 'tokens', liquidatorShareTokens],
        [sToken, borrower, 'borrows', -repayAmount],
        [sTokenCollateral, borrower, 'tokens', -seizeTokens],
        [sTokenCollateral, sTokenCollateral._address, 'reserves', addReservesAmount],
        [sTokenCollateral, sTokenCollateral._address, 'tokens', -protocolShareTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(sTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(sToken, liquidator, borrower, 0, sTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(sToken, liquidator, borrower, repayAmount, sTokenCollateral);
      const gasCost = await etherGasCost(result);
      const afterBalances = await getBalances([sToken, sTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [sToken, 'cash', repayAmount],
        [sToken, 'borrows', -repayAmount],
        [sToken, liquidator, 'eth', -gasCost],
        [sToken, liquidator, 'cash', -repayAmount],
        [sTokenCollateral, liquidator, 'eth', -gasCost],
        [sTokenCollateral, liquidator, 'tokens', liquidatorShareTokens],
        [sTokenCollateral, sTokenCollateral._address, 'reserves', addReservesAmount],
        [sToken, borrower, 'borrows', -repayAmount],
        [sTokenCollateral, borrower, 'tokens', -seizeTokens],
        [sTokenCollateral, sTokenCollateral._address, 'tokens', -protocolShareTokens], // total supply decreases
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(sToken.comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(sTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if sTokenBalances[borrower] < amount", async () => {
      await setBalance(sTokenCollateral, borrower, 1);
      expect(await seize(sTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if sTokenBalances[liquidator] overflows", async () => {
      await setBalance(sTokenCollateral, liquidator, -1);
      expect(await seize(sTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalances([sTokenCollateral], [liquidator, borrower]);
      const result = await seize(sTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([sTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog(['Transfer', 0], {
        from: borrower,
        to: liquidator,
        amount: liquidatorShareTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: sTokenCollateral._address,
        amount: protocolShareTokens.toString()
      });
      expect(result).toHaveLog('ReservesAdded', {
        benefactor: sTokenCollateral._address,
        addAmount: addReservesAmount.toString(),
        newTotalReserves: addReservesAmount.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [sTokenCollateral, liquidator, 'tokens', liquidatorShareTokens],
        [sTokenCollateral, borrower, 'tokens', -seizeTokens],
        [sTokenCollateral, sTokenCollateral._address, 'reserves', addReservesAmount],
        [sTokenCollateral, sTokenCollateral._address, 'tokens', -protocolShareTokens], // total supply decreases
      ]));
    });
  });
});
