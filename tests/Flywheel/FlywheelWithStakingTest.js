const {
  makeComptroller,
  makeSToken,
  makeStaking,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint,
  quickBorrow,
  enterMarkets
} = require('../Utils/Strike');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');
const { default: BigNumber } = require('bignumber.js');

const strikeRate = etherUnsigned(1e18);
const strikeInitialIndex = 1e36;

async function strikeAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'strikeAccrued', [user]));
}

async function strikeBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.strk, 'balanceOf', [user]))
}

async function totalStrikeAccrued(comptroller, user) {
  return (await strikeAccrued(comptroller, user)).add(await strikeBalance(comptroller, user));
}

describe('Flywheel with staking enabled', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, sLOW, sREP, sZRX, sEVIL;
  let staking;
  const strikeMinted = etherUnsigned(1e18).mul(1000);

  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    sLOW = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    sREP = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    sZRX = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    sEVIL = await makeSToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
    sUSD = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 1, collateralFactor: 0.5, interestRateModelOpts});
  
    await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], { from: root });

    staking = await makeStaking();

    expect(await call(staking, 'owner')).toEqual(root);
    expect(await call(staking, 'admin')).toEqual(root);

    await send(staking, 'initialize', [staking.strk._address, [root, comptroller._address]], {from: root});

    expect(await call(staking, 'stakingToken')).toEqual(staking.strk._address);

    expect(await strikeBalance(staking, staking._address)).toEqualNumber(0);
    await send(staking.strk, 'transfer', [staking._address, strikeMinted], {from: root});
    expect(await strikeBalance(staking, staking._address)).toEqualNumber(strikeMinted);

    await send(comptroller, '_setStrkStakingInfo', [staking._address]);
  });

  describe('Grant STRK after staking enabled', () => {
    it('should award strk if called by admin', async() => {
      const tx = await send(comptroller, '_grantSTRK', [a1, 100]);
      expect(tx).toHaveLog('StrikeGranted', {
        recipient: a1,
        amount: 100
      });
    });

    it('should revert if not called by admin', async() => {
      await expect(
        send(comptroller, '_grantSTRK', [a1, 100], { from: a1 })
      ).rejects.toRevert('revert Only Admin can grant STRK');
    });

    it('should revert if insufficient strk', async() => {
      await expect(
        send(comptroller, '_grantSTRK', [a1, etherUnsigned(1e20)])
      ).rejects.toRevert('revert Insufficient STRK for grant');
    });
  });

  describe('claimStrike staking enabled', () => {
    it('should accrue strk and then transfer strike accrued', async () => {
      const strikeRemaining = strikeRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await send(comptroller, '_setStrikeSpeeds', [[sLOW._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const supplySpeed = await call(comptroller, 'strikeSupplySpeeds', [sLOW._address]);
      const borrowSpeed = await call(comptroller, 'strikeBorrowSpeeds', [sLOW._address]);
      const a2AccruedPre = await strikeAccrued(comptroller, a2);
      // const strikeBalancePre = await strikeBalance(comptroller, a2);
      // we ensure that claimed token is transferred to staking
      const strikeBalancePre = await strikeBalance(comptroller, staking._address);
      await quickMint(sLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimStrike', [a2]);
      const a2AccruedPost = await strikeAccrued(comptroller, a2);
      // const strikeBalancePost = await strikeBalance(comptroller, a2);
      // we ensure that claimed token is transferred to staking
      const strikeBalancePost = await strikeBalance(comptroller, staking._address);
      expect(tx.gasUsed).toBeLessThan(700000);
      expect(supplySpeed).toEqualNumber(strikeRate);
      expect(borrowSpeed).toEqualNumber(strikeRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(strikeBalancePre).toEqualNumber(0);
      expect(strikeBalancePost).toEqualNumber(strikeRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue strk and then transfer strike accrued in a single market', async () => {
      const strikeRemaining = strikeRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const supplySpeed = await call(comptroller, 'strikeSupplySpeeds', [sLOW._address]);
      const borrowSpeed = await call(comptroller, 'strikeBorrowSpeeds', [sLOW._address]);
      const a2AccruedPre = await strikeAccrued(comptroller, a2);
      // const strikeBalancePre = await strikeBalance(comptroller, a2);
      // we ensure that claimed token is transferred to staking
      const strikeBalancePre = await strikeBalance(comptroller, staking._address);

      await quickMint(sLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimStrike', [a2, [sLOW._address]]);
      const a2AccruedPost = await strikeAccrued(comptroller, a2);
      // const strikeBalancePost = await strikeBalance(comptroller, a2);
      // we ensure that claimed token is transferred to staking
      const strikeBalancePost = await strikeBalance(comptroller, staking._address);
      expect(tx.gasUsed).toBeLessThan(420000);
      expect(supplySpeed).toEqualNumber(strikeRate);
      expect(borrowSpeed).toEqualNumber(strikeRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(strikeBalancePre).toEqualNumber(0);
      expect(strikeBalancePost).toEqualNumber(strikeRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when strike accrued is below threshold', async () => {
      const strikeRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      await send(comptroller, 'setStrikeAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimStrike', [a1, [sLOW._address]]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0);
      // expect(await strikeBalance(comptroller, a1)).toEqualNumber(accruedAmt);
      // we ensure that claimed token is transferred to staking
      expect(await strikeBalance(comptroller, staking._address)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const sNOT = await makeSToken({comptroller});
      await expect(
        send(comptroller, 'claimStrike', [a1, [sNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });
});
