const {
  etherGasCost,
  etherMantissa,
  etherUnsigned,
  sendFallback
} = require('../Utils/Ethereum');

const {
  makeSToken,
  balanceOf,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/Strike');

const exchangeRate = 5;
const mintAmount = etherUnsigned(1e5);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(sToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(sToken.comptroller, 'setMintAllowed', [true]);
  await send(sToken.comptroller, 'setMintVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintExplicit(sToken, minter, mintAmount) {
  return send(sToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(sToken, minter, mintAmount) {
  return sendFallback(sToken, {from: minter, value: mintAmount});
}

async function preRedeem(sToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(sToken.comptroller, 'setRedeemAllowed', [true]);
  await send(sToken.comptroller, 'setRedeemVerify', [true]);
  await send(sToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(sToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
  await setEtherBalance(sToken, redeemAmount);
  await send(sToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(sToken, redeemer, redeemTokens);
}

async function redeemSTokens(sToken, redeemer, redeemTokens, redeemAmount) {
  return send(sToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(sToken, redeemer, redeemTokens, redeemAmount) {
  return send(sToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('SEther', () => {
  let root, minter, redeemer, accounts;
  let sToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    sToken = await makeSToken({kind: 'sether', comptrollerOpts: {kind: 'bool'}});
    await fastForward(sToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(sToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(sToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([sToken], [minter]);
        const receipt = await mint(sToken, minter, mintAmount);
        const afterBalances = await getBalances([sToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [sToken, 'eth', mintAmount],
          [sToken, 'tokens', mintTokens],
          [sToken, minter, 'eth', -mintAmount.add(await etherGasCost(receipt))],
          [sToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemSTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(sToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(sToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(sToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(sToken, redeemer, redeemTokens.mul(5), redeemAmount.mul(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(sToken);
        const beforeBalances = await getBalances([sToken], [redeemer]);
        const receipt = await redeem(sToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([sToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [sToken, 'eth', -redeemAmount],
          [sToken, 'tokens', -redeemTokens],
          [sToken, redeemer, 'eth', redeemAmount.sub(await etherGasCost(receipt))],
          [sToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
