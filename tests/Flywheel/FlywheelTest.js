const {
  makeComptroller,
  makeSToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/Strike');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const strikeRate = etherUnsigned(1e18);

async function strikeAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'strikeAccrued', [user]));
}

async function strikeBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.strk, 'balanceOf', [user]))
}

async function totalStrikeAccrued(comptroller, user) {
  return (await strikeAccrued(comptroller, user)).add(await strikeBalance(comptroller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the comptroller', () => {
    it('adds the strk markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let strikeMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeSToken({comptroller: unitroller, supportMarket: true});
      }));
      strikeMarkets = strikeMarkets.map(c => c._address);
      unitroller = await makeComptroller({kind: 'unitroller-g3', unitroller, strikeMarkets});
      expect(await call(unitroller, 'getStrikeMarkets')).toEqual(strikeMarkets);
    });

    it('adds the other markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let allMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeSToken({comptroller: unitroller, supportMarket: true});
      }));
      allMarkets = allMarkets.map(c => c._address);
      unitroller = await makeComptroller({
        kind: 'unitroller-g3',
        unitroller,
        strikeMarkets: allMarkets.slice(0, 1),
        otherMarkets: allMarkets.slice(1)
      });
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets);
      expect(await call(unitroller, 'getStrikeMarkets')).toEqual(allMarkets.slice(0, 1));
    });

    it('_supportMarket() adds to all markets, and only once', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makeSToken({comptroller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
      expect(
        makeComptroller({
          kind: 'unitroller-g3',
          unitroller,
          otherMarkets: [allMarkets[0]._address]
        })
      ).rejects.toRevert('revert market already added');
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, sLOW, sREP, sZRX, cEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    sLOW = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    sREP = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    sZRX = await makeSToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    cEVIL = await makeSToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('getStrikeMarkets()', () => {
    it('should return the strk markets', async () => {
      for (let mkt of [sLOW, sREP, sZRX]) {
        await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      }

      expect(await call(comptroller, 'getStrikeMarkets')).toEqual(
        [sLOW, sREP, sZRX].map((c) => c._address)
      );
    });
  });

  describe('SetStrikeSpeed()', () => {
    it('Should update market when calling setStrikeSpeed', async() => {
      const mkt = sREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);

      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(1)]);

      const { index, block } = await call(comptroller, 'strikeSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('Should correctly drop a STRK market if called by admin', async() => {
      for (let mkt of [sLOW, sREP, sZRX]) {
        await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      }

      const tx = await send(comptroller, '_setStrikeSpeed', [sLOW._address, 0]);
      expect(await call(comptroller, 'getStrikeMarkets')).toEqual(
        [sREP, sZRX].map((coin) => coin._address)
      );

      expect(tx).toHaveLog('StrikeSpeedUpdated', {
        sToken: sLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a STRK market from middle of array', async () => {
      for (let mkt of [sLOW, sREP, sZRX]) {
        await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      }
      await send(comptroller, '_setStrikeSpeed', [sREP._address, 0]);
      expect(await call(comptroller, 'getStrikeMarkets')).toEqual(
        [sLOW, sZRX].map((c) => c._address)
      );
    });

    it('should not drop a STRK market unless called by admin', async () => {
      for (let mkt of [sLOW, sREP, sZRX]) {
        await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setStrikeSpeed', [sLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set strike speed');
    });

    it('should not add non-listed markets', async () => {
      const vBAT = await makeSToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddStrikeMarkets', [[vBAT._address]])
      ).rejects.toRevert('revert strike market is not listed');

      const markets = await call(comptroller, 'getStrikeMarkets');
      expect(markets).toEqual([]);
    });    
  });

  describe('updateStrikeBorrowIndex()', () => {
    it('should calculate strk borrower index correctly', async () => {
      const mkt = sREP;
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);      
      await send(comptroller, 'harnessUpdateStrikeBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        strikeAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + strikeAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'strikeBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update strikeBorrowState index if sToken not in STRK markets', async () => {
      const mkt = await makeSToken({
        comptroller: comptroller,
        supportMarket: true,
        addStrikeMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateStrikeBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'strikeBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'strikeSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = sREP;
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdateStrikeBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'strikeBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if strk speed is 0', async () => {
      const mkt = sREP;
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0)]);
      await send(comptroller, 'harnessUpdateStrikeBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'strikeBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateStrikeSupplyIndex()', () => {
    it('should calculate strk supplier index correctly', async () => {
      const mkt = sREP;
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateStrikeSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        strikeAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += strikeAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'strikeSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-STRK markets', async () => {
      const mkt = await makeSToken({
        comptroller: comptroller,
        supportMarket: true,
        addStrikeMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateStrikeSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'strikeSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'strikeSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // stoken could have no strk speed or strk supplier state if not in strk markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = sREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, '_setStrikeSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdateStrikeSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'strikeSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const strikeRemaining = strikeRate.mul(100);
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');

      await quickMint(sLOW, a2, etherUnsigned(10e18));
      await quickMint(sLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalStrikeAccrued(comptroller, a2);
      const a3Accrued0 = await totalStrikeAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(sLOW, a2);
      const a3Balance0 = await balanceOf(sLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(sLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalStrikeAccrued(comptroller, a2);
      const a3Accrued1 = await totalStrikeAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(sLOW, a2);
      const a3Balance1 = await balanceOf(sLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateStrikeSupplyIndex', [sLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(sLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalStrikeAccrued(comptroller, a2);
      const a3Accrued2 = await totalStrikeAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200000);
      expect(txT1.gasUsed).toBeGreaterThan(100000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerStrike()', () => {

    it('should update borrow index checkpoint but not strikeAccrued for first time user', async () => {
      const mkt = sREP;
      await send(comptroller, "setStrikeBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setStrikeBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerStrike", [mkt._address, root, etherExp(1.1)]);
      expect(await call(comptroller, "strikeAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "strikeBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer strk and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = sREP;
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(comptroller, "setStrikeBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setStrikeBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 strikeBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 STRK
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerStrike", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerStrike', {
        sToken: mkt._address,
        borrower: a1,
        strikeDelta: etherUnsigned(25e18).toString(),
        strikeBorrowIndex: etherDouble(6).toString()
      });
    });

    it('should not transfer if below strk claim threshold', async () => {
      const mkt = sREP;
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(comptroller, "setStrikeBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(comptroller, "setStrikeBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < strikeClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerStrike", [mkt._address, a1, etherExp(1.1)]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-STRK market', async () => {
      const mkt = await makeSToken({
        comptroller: comptroller,
        supportMarket: true,
        addStrikeMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerStrike", [mkt._address, a1, etherExp(1.1)]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'strikeBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierStrike()', () => {
    it('should transfer strk and update supply index correctly for first time user', async () => {
      const mkt = sREP;
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setStrikeSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 strikeSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 STRK:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierStrike", [mkt._address, a1]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierStrike', {
        sToken: mkt._address,
        supplier: a1,
        strikeDelta: etherUnsigned(25e18).toString(),
        strikeSupplyIndex: etherDouble(6).toString()
      });
    });

    it('should update strike accrued and supply index for repeat user', async () => {
      const mkt = sREP;
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setStrikeSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setStrikeSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierStrike", [mkt._address, a1]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when strikeAccrued below threshold', async () => {
      const mkt = sREP;
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(comptroller, "setStrikeSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierStrike", [mkt._address, a1]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-STRK market', async () => {
      const mkt = await makeSToken({
        comptroller: comptroller,
        supportMarket: true,
        addStrikeMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierStrike", [mkt._address, a1]);
      expect(await strikeAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'strikeBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferStrike', () => {
    it('should transfer strike accrued when amount is above threshold', async () => {
      const strikeRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const strikeBalancePre = await strikeBalance(comptroller, a1);
      const tx0 = await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      const tx1 = await send(comptroller, 'setStrikeAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferStrike', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await strikeAccrued(comptroller, a1);
      const strikeBalancePost = await strikeBalance(comptroller, a1);
      expect(strikeBalancePre).toEqualNumber(0);
      expect(strikeBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when strike accrued is below threshold', async () => {
      const strikeRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const strikeBalancePre = await call(comptroller.strk, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      const tx1 = await send(comptroller, 'setStrikeAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferStrike', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await strikeAccrued(comptroller, a1);
      const strikeBalancePost = await strikeBalance(comptroller, a1);
      expect(strikeBalancePre).toEqualNumber(0);
      expect(strikeBalancePost).toEqualNumber(0);
    });

    it('should not transfer strk if strike accrued is greater than strk remaining', async () => {
      const strikeRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const strikeBalancePre = await strikeBalance(comptroller, a1);
      const tx0 = await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      const tx1 = await send(comptroller, 'setStrikeAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferStrike', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await strikeAccrued(comptroller, a1);
      const strikeBalancePost = await strikeBalance(comptroller, a1);
      expect(strikeBalancePre).toEqualNumber(0);
      expect(strikeBalancePost).toEqualNumber(0);
    });
  });

  describe('claimStrike', () => {
    it('should accrue strk and then transfer strike accrued', async () => {
      const strikeRemaining = strikeRate.mul(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await send(comptroller, '_setStrikeSpeed', [sLOW._address, etherExp(0.5)]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const speed = await call(comptroller, 'strikeSpeeds', [sLOW._address]);
      const a2AccruedPre = await strikeAccrued(comptroller, a2);
      const strikeBalancePre = await strikeBalance(comptroller, a2);
      await quickMint(sLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimStrike', [a2]);
      const a2AccruedPost = await strikeAccrued(comptroller, a2);
      const strikeBalancePost = await strikeBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(strikeRate);
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
      const speed = await call(comptroller, 'strikeSpeeds', [sLOW._address]);
      const a2AccruedPre = await strikeAccrued(comptroller, a2);
      const strikeBalancePre = await strikeBalance(comptroller, a2);
      await quickMint(sLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimStrike', [a2, [sLOW._address]]);
      const a2AccruedPost = await strikeAccrued(comptroller, a2);
      const strikeBalancePost = await strikeBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(220000);
      expect(speed).toEqualNumber(strikeRate);
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
      expect(await strikeBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const sNOT = await makeSToken({comptroller});
      await expect(
        send(comptroller, 'claimStrike', [a1, [sNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimStrike batch', () => {
    it('should revert when claiming strk from non-listed market', async () => {
      const strikeRemaining = strikeRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(sLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(sLOW.underlying, 'approve', [sLOW._address, mintAmount], { from });
        send(sLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(sLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessRefreshStrikeSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimStrike', [claimAccts, [sLOW._address, cEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });


    it('should claim the expected amount when holders and stokens arg is duplicated', async () => {
      const strikeRemaining = strikeRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(sLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(sLOW.underlying, 'approve', [sLOW._address, mintAmount], { from });
        send(sLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(sLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimStrike', [[...claimAccts, ...claimAccts], [sLOW._address, sLOW._address], false, true]);
      // strk distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'strikeSupplierIndex', [sLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await strikeBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims strk for multiple suppliers only', async () => {
      const strikeRemaining = strikeRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(sLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(sLOW.underlying, 'approve', [sLOW._address, mintAmount], { from });
        send(sLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(sLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimStrike', [claimAccts, [sLOW._address], false, true]);
      // strk distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'strikeSupplierIndex', [sLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await strikeBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims strk for multiple borrowers only, primes uninitiated', async () => {
      const strikeRemaining = strikeRate.mul(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(comptroller.strk, 'transfer', [comptroller._address, strikeRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(sLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(sLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimStrike', [claimAccts, [sLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'strikeBorrowerIndex', [sLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(comptroller, 'strikeSupplierIndex', [sLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const sNOT = await makeSToken({comptroller});
      await expect(
        send(comptroller, 'claimStrike', [[a1, a2], [sNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('harnessRefreshStrikeSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const speed = await call(comptroller, 'strikeSpeeds', [sLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const speed = await call(comptroller, 'strikeSpeeds', [sLOW._address]);
      expect(speed).toEqualNumber(strikeRate);
      expect(tx).toHaveLog(['StrikeSpeedUpdated', 0], {
        sToken: sLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(sLOW, a1, 1, 1, 100);
      await pretendBorrow(sZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address, sZRX._address]]);
      await send(comptroller, 'harnessRefreshStrikeSpeeds');
      const speed1 = await call(comptroller, 'strikeSpeeds', [sLOW._address]);
      const speed2 = await call(comptroller, 'strikeSpeeds', [sREP._address]);
      const speed3 = await call(comptroller, 'strikeSpeeds', [sZRX._address]);
      expect(speed1).toEqualNumber(strikeRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(strikeRate.div(4).mul(3));
    });
  });

  /* describe('_addStrikeMarkets', () => {
    it('should correctly add a strike market if called by admin', async () => {
      const sBAT = await makeSToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddStrikeMarkets', [[sLOW._address, sREP._address, sZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddStrikeMarkets', [[sBAT._address]]);
      const markets = await call(comptroller, 'getStrikeMarkets');
      expect(markets).toEqual([sLOW, sREP, sZRX, sBAT].map((c) => c._address));
      expect(tx2).toHaveLog('StrikeSpeedUpdated', {
        sToken: sBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = sLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(comptroller, "harnessAddStrikeMarkets", [[mkt]]);
      await send(comptroller, "setStrikeSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setStrikeBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setStrikeSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddStrikeMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'strikeSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'strikeBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  }); */

  describe('Grant STRK', () => {
    beforeEach(async () => {
      await send(comptroller.strk, 'transfer', [comptroller._address, etherUnsigned(50e18)], { from: root });
    });

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

  describe('updateContributorRewards', () => {
    it ('should not fail when contributor rewards called on non-contributor', async() => {
      const tx1 = await send(comptroller, 'updateContributorRewards', [a1]);
    });

    it ('should accrue strk to contributors', async() => {
      const tx1 = await send(comptroller, '_setContributorStrikeSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const a1Accrued = await strikeAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(0);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], { from: a1 });
      const a1Accrued2 = await strikeAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });

    it ('should accrue strk with last set', async() => {
      await fastForward(comptroller, 1000);
      const tx1 = await send(comptroller, '_setContributorStrikeSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], { from: a1 });
      const a1Accrued2 = await strikeAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });
  });

  describe('_setContributorStrikeSpeed', () => {
    it ('should revert if not called by admin', async() => {
      await expect(
        send(comptroller, '_setContributorStrikeSpeed', [a1, 1000], { from: a1 })
      ).rejects.toRevert('revert Only Admin can set STRK speed');
    });

    it ('should start strk stream if called by admin', async() => {
      const tx = await send(comptroller, '_setContributorStrikeSpeed', [a1, 1000]);
      expect(tx).toHaveLog('ContributorStrikeSpeedUpdated', {
        contributor: a1,
        newStrikeSpeed: 1000
      });
    });

    it ('should reset strk stream if set to 0', async () => {
      const tx1 = await send(comptroller, '_setContributorStrikeSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, '_setContributorStrikeSpeed', [a1, 0]);
      await fastForward(comptroller, 50);

      const tx3 = await send(comptroller, 'updateContributorRewards', [a1], { from: a1 });
      const a1Accrued = await strikeAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(50 * 2000);
    });
  });
});
