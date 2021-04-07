const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/Strike');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(sToken, borrower, borrowAmount) {
  await send(sToken.comptroller, 'setBorrowAllowed', [true]);
  await send(sToken.comptroller, 'setBorrowVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken.underlying, 'harnessSetBalance', [sToken._address, borrowAmount]);
  await send(sToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(sToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(sToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(sToken, borrower, borrowAmount) {
  return send(sToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(sToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(sToken, 'harnessFastForward', [1]);
  return send(sToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(sToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(sToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(sToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(sToken, borrower, 1, 1, repayAmount);
  await preApprove(sToken, benefactor, repayAmount);
  await preApprove(sToken, borrower, repayAmount);
}

async function repayBorrowFresh(sToken, payer, borrower, repayAmount) {
  return send(sToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(sToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(sToken, 'harnessFastForward', [1]);
  return send(sToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(sToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(sToken, 'harnessFastForward', [1]);
  return send(sToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('SToken', function () {
  let sToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    sToken = await makeSToken({comptrollerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(sToken, borrower, borrowAmount));

    it("fails if comptroller tells it to", async () => {
      await send(sToken.comptroller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(sToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_COMPTROLLER_REJECTION');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await borrowFresh(sToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(sToken);
      expect(await borrowFresh(sToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(sToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(sToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(sToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(sToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(sToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(sToken, borrower, 1e-18, 1e-18, -1);
      expect(await borrowFresh(sToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(sToken, 'harnessSetTotalBorrows', [-1]);
      expect(await borrowFresh(sToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(sToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(sToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("reverts if borrowVerify fails", async() => {
      await send(sToken.comptroller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(sToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(sToken.underlying, sToken._address);
      const beforeProtocolBorrows = await totalBorrows(sToken);
      const beforeAccountCash = await balanceOf(sToken.underlying, borrower);
      const result = await borrowFresh(sToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(sToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
      expect(await balanceOf(sToken.underlying, sToken._address)).toEqualNumber(beforeProtocolCash.sub(borrowAmount));
      expect(await totalBorrows(sToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: sToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.add(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(sToken);
      await pretendBorrow(sToken, borrower, 0, 3, 0);
      await borrowFresh(sToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(sToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(sToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(sToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(sToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(sToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(sToken.underlying, borrower);
      await fastForward(sToken);
      expect(await borrow(sToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(sToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
          await preRepay(sToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(sToken.comptroller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(sToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_COMPTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(sToken);
          expect(await repayBorrowFresh(sToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it("fails if insufficient approval", async() => {
          await preApprove(sToken, payer, 1);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(sToken.underlying, payer, 1);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(sToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(sToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(sToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(sToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(sToken.underlying, sToken._address);
          const result = await repayBorrowFresh(sToken, payer, borrower, repayAmount);
          expect(await balanceOf(sToken.underlying, sToken._address)).toEqualNumber(beforeProtocolCash.add(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: sToken._address,
            amount: repayAmount.toString()
          });
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(sToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
          expect(await repayBorrowFresh(sToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(sToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(sToken)).toEqualNumber(beforeProtocolBorrows.sub(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(sToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(sToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(sToken.underlying, borrower, 1);
      await expect(repayBorrow(sToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(sToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
      expect(await repayBorrow(sToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(sToken);
      expect(await repayBorrow(sToken, borrower, -1)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(sToken.underlying, borrower, 3);
      await fastForward(sToken);
      await expect(repayBorrow(sToken, borrower, -1)).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(sToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(sToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(sToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(sToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(sToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
      expect(await repayBorrowBehalf(sToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(sToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });
  });
});
