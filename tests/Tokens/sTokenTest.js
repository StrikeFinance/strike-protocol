const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSToken,
  setBorrowRate,
  pretendBorrow
} = require('../Utils/Strike');

describe('SToken', function () {
  let root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("fails when non erc-20 underlying", async () => {
      await expect(makeSToken({ underlying: { _address: root } })).rejects.toRevert("revert");
    });

    it("fails when 0 initial exchange rate", async () => {
      await expect(makeSToken({ exchangeRate: 0 })).rejects.toRevert("revert initial exchange rate must be greater than zero.");
    });

    it("succeeds with erc-20 underlying and non-zero exchange rate", async () => {
      const sToken = await makeSToken();
      expect(await call(sToken, 'underlying')).toEqual(sToken.underlying._address);
      expect(await call(sToken, 'admin')).toEqual(root);
    });

    it("succeeds when setting admin to contructor argument", async () => {
      const sToken = await makeSToken({ admin: admin });
      expect(await call(sToken, 'admin')).toEqual(admin);
    });
  });

  describe('name, symbol, decimals', () => {
    let sToken;

    beforeEach(async () => {
      sToken = await makeSToken({ name: "SToken Foo", symbol: "cFOO", decimals: 10 });
    });

    it('should return correct name', async () => {
      expect(await call(sToken, 'name')).toEqual("SToken Foo");
    });

    it('should return correct symbol', async () => {
      expect(await call(sToken, 'symbol')).toEqual("cFOO");
    });

    it('should return correct decimals', async () => {
      expect(await call(sToken, 'decimals')).toEqualNumber(10);
    });
  });

  describe('balanceOfUnderlying', () => {
    it("has an underlying balance", async () => {
      const sToken = await makeSToken({ supportMarket: true, exchangeRate: 2 });
      await send(sToken, 'harnessSetBalance', [root, 100]);
      expect(await call(sToken, 'balanceOfUnderlying', [root])).toEqualNumber(200);
    });
  });

  describe('borrowRatePerBlock', () => {
    it("has a borrow rate", async () => {
      const sToken = await makeSToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(sToken, 'borrowRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - 5e16)).toBeLessThanOrEqual(1e8);
    });
  });

  describe('supplyRatePerBlock', () => {
    it("returns 0 if there's no supply", async () => {
      const sToken = await makeSToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(sToken, 'supplyRatePerBlock');
      await expect(perBlock).toEqualNumber(0);
    });

    it("has a supply rate", async () => {
      const baseRate = 0.05;
      const multiplier = 0.45;
      const kink = 0.95;
      const jump = 5 * multiplier;
      const sToken = await makeSToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate, multiplier, kink, jump } });
      await send(sToken, 'harnessSetReserveFactorFresh', [etherMantissa(.01)]);
      await send(sToken, 'harnessExchangeRateDetails', [1, 1, 0]);
      await send(sToken, 'harnessSetExchangeRate', [etherMantissa(1)]);
      // Full utilization (Over the kink so jump is included), 1% reserves
      const borrowRate = baseRate + multiplier * kink + jump * .05;
      const expectedSuplyRate = borrowRate * .99;

      const perBlock = await call(sToken, 'supplyRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - expectedSuplyRate * 1e18)).toBeLessThanOrEqual(1e8);
    });
  });

  describe("borrowBalanceCurrent", () => {
    let borrower;
    let sToken;

    beforeEach(async () => {
      borrower = accounts[0];
      sToken = await makeSToken();
    });

    beforeEach(async () => {
      await setBorrowRate(sToken, .001)
      await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
    });

    it("reverts if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      // make sure we accrue interest
      await send(sToken, 'harnessFastForward', [1]);
      await expect(send(sToken, 'borrowBalanceCurrent', [borrower])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns successful result from borrowBalanceStored with no interest", async () => {
      await setBorrowRate(sToken, 0);
      await pretendBorrow(sToken, borrower, 1, 1, 5e18);
      expect(await call(sToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18)
    });

    it("returns successful result from borrowBalanceCurrent with no interest", async () => {
      await setBorrowRate(sToken, 0);
      await pretendBorrow(sToken, borrower, 1, 3, 5e18);
      expect(await send(sToken, 'harnessFastForward', [5])).toSucceed();
      expect(await call(sToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18 * 3)
    });
  });

  describe("borrowBalanceStored", () => {
    let borrower;
    let sToken;

    beforeEach(async () => {
      borrower = accounts[0];
      sToken = await makeSToken({ comptrollerOpts: { kind: 'bool' } });
    });

    it("returns 0 for account with no borrows", async () => {
      expect(await call(sToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
    });

    it("returns stored principal when account and market indexes are the same", async () => {
      await pretendBorrow(sToken, borrower, 1, 1, 5e18);
      expect(await call(sToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18);
    });

    it("returns calculated balance when market index is higher than account index", async () => {
      await pretendBorrow(sToken, borrower, 1, 3, 5e18);
      expect(await call(sToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18 * 3);
    });

    it("has undefined behavior when market index is lower than account index", async () => {
      // The market index < account index should NEVER happen, so we don't test this case
    });

    it("reverts on overflow of principal", async () => {
      await pretendBorrow(sToken, borrower, 1, 3, -1);
      await expect(call(sToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });

    it("reverts on non-zero stored principal with zero account index", async () => {
      await pretendBorrow(sToken, borrower, 0, 3, 5);
      await expect(call(sToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });
  });

  describe('exchangeRateStored', () => {
    let sToken, exchangeRate = 2;

    beforeEach(async () => {
      sToken = await makeSToken({ exchangeRate });
    });

    it("returns initial exchange rate with zero sTokenSupply", async () => {
      const result = await call(sToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(exchangeRate));
    });

    it("calculates with single sTokenSupply and single total borrow", async () => {
      const sTokenSupply = 1, totalBorrows = 1, totalReserves = 0;
      await send(sToken, 'harnessExchangeRateDetails', [sTokenSupply, totalBorrows, totalReserves]);
      const result = await call(sToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1));
    });

    it("calculates with sTokenSupply and total borrows", async () => {
      const sTokenSupply = 100e18, totalBorrows = 10e18, totalReserves = 0;
      await send(sToken, 'harnessExchangeRateDetails', [sTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(sToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(.1));
    });

    it("calculates with cash and sTokenSupply", async () => {
      const sTokenSupply = 5e18, totalBorrows = 0, totalReserves = 0;
      expect(
        await send(sToken.underlying, 'transfer', [sToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(sToken, 'harnessExchangeRateDetails', [sTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(sToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(100));
    });

    it("calculates with cash, borrows, reserves and sTokenSupply", async () => {
      const sTokenSupply = 500e18, totalBorrows = 500e18, totalReserves = 5e18;
      expect(
        await send(sToken.underlying, 'transfer', [sToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(sToken, 'harnessExchangeRateDetails', [sTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(sToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1.99));
    });
  });

  describe('getCash', () => {
    it("gets the cash", async () => {
      const sToken = await makeSToken();
      const result = await call(sToken, 'getCash');
      expect(result).toEqualNumber(0);
    });
  });
});
