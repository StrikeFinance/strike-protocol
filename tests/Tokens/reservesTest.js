const { etherUnsigned, etherMantissa, both } = require("../Utils/Ethereum");

const {
  fastForward,
  makeSToken,
  getBalances,
  adjustBalances,
  etherExp
} = require("../Utils/Strike");

const factor = etherMantissa(0.02);

const reserves = etherUnsigned(3e12);
const cash = etherUnsigned(reserves.mul(2));
const reduction = etherUnsigned(2e12);

describe("SToken", function () {
  let root, reserveGuardian, reserveAddress, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    reserveGuardian = saddle.accounts[4];
    reserveAddress = saddle.accounts[4];
  });

  describe("_setReserveFactorFresh", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
    });

    it("rejects change by non-admin", async () => {
      expect(
        await send(sToken, "harnessSetReserveFactorFresh", [factor], {
          from: accounts[0],
        })
      ).toHaveTokenFailure("UNAUTHORIZED", "SET_RESERVE_FACTOR_ADMIN_CHECK");
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });

    it("rejects change if market not fresh", async () => {
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(
        await send(sToken, "harnessSetReserveFactorFresh", [factor])
      ).toHaveTokenFailure(
        "MARKET_NOT_FRESH",
        "SET_RESERVE_FACTOR_FRESH_CHECK"
      );
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });

    it("rejects newReserveFactor that descales to 1", async () => {
      expect(
        await send(sToken, "harnessSetReserveFactorFresh", [
          etherMantissa(1.01),
        ])
      ).toHaveTokenFailure("BAD_INPUT", "SET_RESERVE_FACTOR_BOUNDS_CHECK");
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });

    it("accepts newReserveFactor in valid range and emits log", async () => {
      const result = await send(sToken, "harnessSetReserveFactorFresh", [
        factor,
      ]);
      expect(result).toSucceed();
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(factor);
      expect(result).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: "0",
        newReserveFactorMantissa: factor.toString(),
      });
    });

    it("accepts a change back to zero", async () => {
      const result1 = await send(sToken, "harnessSetReserveFactorFresh", [
        factor,
      ]);
      const result2 = await send(sToken, "harnessSetReserveFactorFresh", [0]);
      expect(result1).toSucceed();
      expect(result2).toSucceed();
      expect(result2).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: factor.toString(),
        newReserveFactorMantissa: "0",
      });
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });
  });

  describe("_setReserveFactor", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
    });

    beforeEach(async () => {
      await send(sToken.interestRateModel, "setFailBorrowRate", [false]);
      await send(sToken, "_setReserveFactor", [0]);
    });

    it("emits a reserve factor failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, "setFailBorrowRate", [true]);
      await fastForward(sToken, 1);
      await expect(
        send(sToken, "_setReserveFactor", [factor])
      ).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });

    it("returns error from setReserveFactorFresh without emitting any extra logs", async () => {
      const { reply, receipt } = await both(sToken, "_setReserveFactor", [
        etherMantissa(2),
      ]);
      expect(reply).toHaveTokenError("BAD_INPUT");
      expect(receipt).toHaveTokenFailure(
        "BAD_INPUT",
        "SET_RESERVE_FACTOR_BOUNDS_CHECK"
      );
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
    });

    it("returns success from setReserveFactorFresh", async () => {
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(0);
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(await send(sToken, "_setReserveFactor", [factor])).toSucceed();
      expect(await call(sToken, "reserveFactorMantissa")).toEqualNumber(factor);
    });
  });

  describe("_reduceReservesFresh", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
      expect(
        await send(sToken, "harnessSetTotalReserves", [reserves])
      ).toSucceed();
      expect(
        await send(sToken.underlying, "harnessSetBalance", [
          sToken._address,
          cash,
        ])
      ).toSucceed();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(sToken, "harnessReduceReservesFresh", [reduction], {
          from: accounts[0],
        })
      ).toHaveTokenFailure("UNAUTHORIZED", "REDUCE_RESERVES_ADMIN_CHECK");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if market not fresh", async () => {
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(
        await send(sToken, "harnessReduceReservesFresh", [reduction])
      ).toHaveTokenFailure("MARKET_NOT_FRESH", "REDUCE_RESERVES_FRESH_CHECK");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if amount exceeds reserves", async () => {
      expect(
        await send(sToken, "harnessReduceReservesFresh", [reserves.add(1)])
      ).toHaveTokenFailure("BAD_INPUT", "REDUCE_RESERVES_VALIDATION");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if amount exceeds available cash", async () => {
      const cashLessThanReserves = reserves.sub(2);
      await send(sToken.underlying, "harnessSetBalance", [
        sToken._address,
        cashLessThanReserves,
      ]);
      expect(
        await send(sToken, "harnessReduceReservesFresh", [reserves])
      ).toHaveTokenFailure(
        "TOKEN_INSUFFICIENT_CASH",
        "REDUCE_RESERVES_CASH_NOT_AVAILABLE"
      );
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("increases admin balance and reduces reserves on success", async () => {
      const balance = etherUnsigned(
        await call(sToken.underlying, "balanceOf", [root])
      );
      expect(
        await send(sToken, "harnessReduceReservesFresh", [reserves])
      ).toSucceed();
      expect(await call(sToken.underlying, "balanceOf", [root])).toEqualNumber(
        balance.add(reserves)
      );
      expect(await call(sToken, "totalReserves")).toEqualNumber(0);
    });

    it("emits an event on success", async () => {
      const result = await send(sToken, "harnessReduceReservesFresh", [
        reserves,
      ]);
      expect(result).toHaveLog("ReservesReduced", {
        admin: root,
        reduceAmount: reserves.toString(),
        newTotalReserves: "0",
      });
    });
  });

  describe("_reduceReserves", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
      await send(sToken.interestRateModel, "setFailBorrowRate", [false]);
      expect(
        await send(sToken, "harnessSetTotalReserves", [reserves])
      ).toSucceed();
      expect(
        await send(sToken.underlying, "harnessSetBalance", [
          sToken._address,
          cash,
        ])
      ).toSucceed();
    });

    it("emits a reserve-reduction failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, "setFailBorrowRate", [true]);
      await fastForward(sToken, 1);
      await expect(
        send(sToken, "_reduceReserves", [reduction])
      ).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from _reduceReservesFresh without emitting any extra logs", async () => {
      const { reply, receipt } = await both(
        sToken,
        "harnessReduceReservesFresh",
        [reserves.add(1)]
      );
      expect(reply).toHaveTokenError("BAD_INPUT");
      expect(receipt).toHaveTokenFailure(
        "BAD_INPUT",
        "REDUCE_RESERVES_VALIDATION"
      );
    });

    it("returns success code from _reduceReservesFresh and reduces the correct amount", async () => {
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(await send(sToken, "_reduceReserves", [reduction])).toSucceed();
    });
  });

  describe("_transferReservesFresh", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
      expect(
        await send(sToken, "harnessSetTotalReserves", [reserves])
      ).toSucceed();
      expect(
        await send(sToken.underlying, "harnessSetBalance", [
          sToken._address,
          cash,
        ])
      ).toSucceed();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(sToken, "harnessTransferReservesFresh", [reduction], {
          from: accounts[0],
        })
      ).toHaveTokenFailure("UNAUTHORIZED", "TRANSFER_RESERVES_ADMIN_CHECK");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if market not fresh", async () => {
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(
        await send(sToken, "harnessTransferReservesFresh", [reduction], {from: reserveGuardian})
      ).toHaveTokenFailure("MARKET_NOT_FRESH", "TRANSFER_RESERVES_FRESH_CHECK");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if amount exceeds reserves", async () => {
      expect(
        await send(sToken, "harnessTransferReservesFresh", [reserves.add(1)], {from: reserveGuardian})
      ).toHaveTokenFailure("BAD_INPUT", "TRANSFER_RESERVES_VALIDATION");
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("fails if amount exceeds available cash", async () => {
      const cashLessThanReserves = reserves.sub(2);
      await send(sToken.underlying, "harnessSetBalance", [
        sToken._address,
        cashLessThanReserves,
      ]);
      expect(
        await send(sToken, "harnessTransferReservesFresh", [reserves], {from: reserveGuardian})
      ).toHaveTokenFailure(
        "TOKEN_INSUFFICIENT_CASH",
        "TRANSFER_RESERVES_CASH_NOT_AVAILABLE"
      );
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
    });

    it("increases reserve address balance and reduces reserves on success", async () => {
      const balance = etherUnsigned(
        await call(sToken.underlying, "balanceOf", [reserveAddress])
      );
      expect(
        await send(sToken, "harnessTransferReservesFresh", [reserves], {from: reserveGuardian})
      ).toSucceed();
      expect(await call(sToken.underlying, "balanceOf", [reserveAddress])).toEqualNumber(
        balance.add(reserves)
      );
      expect(await call(sToken, "totalReserves")).toEqualNumber(0);
    });

    it("emits an event on success", async () => {
      const result = await send(sToken, "harnessTransferReservesFresh", [
        reserves,
      ], {from: reserveGuardian});
      expect(result).toHaveLog("TransferReserves", {
        guardian: reserveGuardian,
        reserveAddress: reserveAddress,
        reduceAmount: reserves.toString(),
        newTotalReserves: "0",
      });
    });
  });

  describe("_transferReserves", () => {
    let sToken;
    beforeEach(async () => {
      sToken = await makeSToken();
      await send(sToken.interestRateModel, "setFailBorrowRate", [false]);
      expect(
        await send(sToken, "harnessSetTotalReserves", [reserves])
      ).toSucceed();
      expect(
        await send(sToken.underlying, "harnessSetBalance", [
          sToken._address,
          cash,
        ])
      ).toSucceed();
    });

    it("emits a reserve-reduction failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, "setFailBorrowRate", [true]);
      await fastForward(sToken, 1);
      await expect(
        send(sToken, "_transferReserves", [reduction], {from: reserveGuardian})
      ).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from _transferReservesFresh without emitting any extra logs", async () => {
      const { reply, receipt } = await both(
        sToken,
        "harnessTransferReservesFresh",
        [reserves.add(1)], {from: reserveGuardian}
      );
      expect(reply).toHaveTokenError("BAD_INPUT");
      expect(receipt).toHaveTokenFailure(
        "BAD_INPUT",
        "TRANSFER_RESERVES_VALIDATION"
      );
    });

    it("returns success code from _transferReservesFresh and reduces the correct amount", async () => {
      expect(await call(sToken, "totalReserves")).toEqualNumber(reserves);
      expect(await send(sToken, "harnessFastForward", [5])).toSucceed();
      expect(await send(sToken, "_transferReserves", [reduction], {from: reserveGuardian})).toSucceed();
    });
  });
});
