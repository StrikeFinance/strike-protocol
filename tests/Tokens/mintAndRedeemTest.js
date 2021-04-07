const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSToken,
  balanceOf,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  preApprove,
  quickMint,
  preSupply,
  quickRedeem,
  quickRedeemUnderlying
} = require('../Utils/Strike');

const exchangeRate = 50e3;
const mintAmount = etherUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(sToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(sToken, minter, mintAmount);
  await send(sToken.comptroller, 'setMintAllowed', [true]);
  await send(sToken.comptroller, 'setMintVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(sToken, 'harnessSetBalance', [minter, 0]);
  await send(sToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintFresh(sToken, minter, mintAmount) {
  return send(sToken, 'harnessMintFresh', [minter, mintAmount]);
}

async function preRedeem(sToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await preSupply(sToken, redeemer, redeemTokens);
  await send(sToken.comptroller, 'setRedeemAllowed', [true]);
  await send(sToken.comptroller, 'setRedeemVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken.underlying, 'harnessSetBalance', [sToken._address, redeemAmount]);
  await send(sToken.underlying, 'harnessSetBalance', [redeemer, 0]);
  await send(sToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
  await send(sToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function redeemFreshTokens(sToken, redeemer, redeemTokens, redeemAmount) {
  return send(sToken, 'harnessRedeemFresh', [redeemer, redeemTokens, 0]);
}

async function redeemFreshAmount(sToken, redeemer, redeemTokens, redeemAmount) {
  return send(sToken, 'harnessRedeemFresh', [redeemer, 0, redeemAmount]);
}

describe('SToken', function () {
  let root, minter, redeemer, accounts;
  let sToken;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    sToken = await makeSToken({comptrollerOpts: {kind: 'bool'}, exchangeRate});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(sToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("fails if comptroller tells it to", async () => {
      await send(sToken.comptroller, 'setMintAllowed', [false]);
      expect(await mintFresh(sToken, minter, mintAmount)).toHaveTrollReject('MINT_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await mintFresh(sToken, minter, mintAmount)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(sToken);
      expect(await mintFresh(sToken, minter, mintAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(sToken, 'accrueInterest')).toSucceed();
      expect(await mintFresh(sToken, minter, mintAmount)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(sToken.underlying, 'approve', [sToken._address, 1], {from: minter})
      ).toSucceed();
      await expect(mintFresh(sToken, minter, mintAmount)).rejects.toRevert('revert Insufficient allowance');
    });

    it("fails if insufficient balance", async() => {
      await setBalance(sToken.underlying, minter, 1);
      await expect(mintFresh(sToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("proceeds if sufficient approval and balance", async () =>{
      expect(await mintFresh(sToken, minter, mintAmount)).toSucceed();
    });

    it("fails if exchange calculation fails", async () => {
      expect(await send(sToken, 'harnessSetExchangeRate', [0])).toSucceed();
      await expect(mintFresh(sToken, minter, mintAmount)).rejects.toRevert('revert MINT_EXCHANGE_CALCULATION_FAILED');
    });

    it("fails if transferring in fails", async () => {
      await send(sToken.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(sToken, minter, mintAmount)).rejects.toRevert('revert TOKEN_TRANSFER_IN_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([sToken], [minter]);
      const result = await mintFresh(sToken, minter, mintAmount);
      const afterBalances = await getBalances([sToken], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: mintAmount.toString(),
        mintTokens: mintTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: sToken._address,
        to: minter,
        amount: mintTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [sToken, minter, 'cash', -mintAmount],
        [sToken, minter, 'tokens', mintTokens],
        [sToken, 'cash', mintAmount],
        [sToken, 'tokens', mintTokens]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(sToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMint(sToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from mintFresh without emitting any extra logs", async () => {
      await send(sToken.underlying, 'harnessSetBalance', [minter, 1]);
      await expect(mintFresh(sToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMint(sToken, minter, mintAmount)).toSucceed();
      expect(mintTokens).not.toEqualNumber(0);
      expect(await balanceOf(sToken, minter)).toEqualNumber(mintTokens);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(sToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });

  [redeemFreshTokens, redeemFreshAmount].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(sToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("fails if comptroller tells it to", async () =>{
        await send(sToken.comptroller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTrollReject('REDEEM_COMPTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(sToken);
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(sToken, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toSucceed();
      });

      it("fails if insufficient protocol cash to transfer out", async() => {
        await send(sToken.underlying, 'harnessSetBalance', [sToken._address, 1]);
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
      });

      it("fails if exchange calculation fails", async () => {
        if (redeemFresh == redeemFreshTokens) {
          expect(await send(sToken, 'harnessSetExchangeRate', [-1])).toSucceed();
          expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED');
        } else {
          expect(await send(sToken, 'harnessSetExchangeRate', [0])).toSucceed();
          expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED');
        }
      });

      it("fails if transferring out fails", async () => {
        await send(sToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
      });

      it("fails if total supply < redemption amount", async () => {
        await send(sToken, 'harnessExchangeRateDetails', [0, 0, 0]);
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("reverts if new account balance underflows", async () => {
        await send(sToken, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([sToken], [redeemer]);
        const result = await redeemFresh(sToken, redeemer, redeemTokens, redeemAmount);
        const afterBalances = await getBalances([sToken], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: redeemAmount.toString(),
          redeemTokens: redeemTokens.toString()
        });
        expect(result).toHaveLog(['Transfer', 1], {
          from: redeemer,
          to: sToken._address,
          amount: redeemTokens.toString()
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [sToken, redeemer, 'cash', redeemAmount],
          [sToken, redeemer, 'tokens', -redeemTokens],
          [sToken, 'cash', -redeemAmount],
          [sToken, 'tokens', -redeemTokens]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(sToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeem(sToken, redeemer, redeemTokens)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from redeemFresh without emitting any extra logs", async () => {
      await setBalance(sToken.underlying, sToken._address, 0);
      expect(await quickRedeem(sToken, redeemer, redeemTokens, {exchangeRate})).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
    });

    it("returns success from redeemFresh and redeems the right amount", async () => {
      expect(
        await send(sToken.underlying, 'harnessSetBalance', [sToken._address, redeemAmount])
      ).toSucceed();
      expect(await quickRedeem(sToken, redeemer, redeemTokens, {exchangeRate})).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(sToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await send(sToken.underlying, 'harnessSetBalance', [sToken._address, redeemAmount])
      ).toSucceed();
      expect(
        await quickRedeemUnderlying(sToken, redeemer, redeemAmount, {exchangeRate})
      ).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(sToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(sToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "500000000",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });
});
