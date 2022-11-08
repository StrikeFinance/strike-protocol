const { default: BigNumber } = require('bignumber.js');
const {
  etherUnsigned,
  etherMantissa,
  both,
  minerStart,
  minerStop,
} = require('../Utils/Ethereum');

const {
  makeStaking,
  balanceOf,
  fastForward,
  preApprove
} = require('../Utils/Strike');

async function strikeBalance(staking, user) {
  return etherUnsigned(await call(staking.strk, 'balanceOf', [user]))
}

describe('Staking', () => {
  let root, accounts;
  let staking;
  const strikeMinted = etherUnsigned(1e18).mul(1000);
  const withdrawAmount = etherUnsigned(1e18).mul(100);
  const estimatedLeftAmount = etherUnsigned(1e18).mul(400);
  const estimatedLeftPenaltyAmount = etherUnsigned(1e18).mul(400);
  const deltaTimestamp = 10000;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    staking = await makeStaking();

    expect(await call(staking, 'owner')).toEqual(root);
    expect(await call(staking, 'admin')).toEqual(root);

    await send(staking, 'initialize', [staking.strk._address, [root]], {from: root});

    expect(await call(staking, 'stakingToken')).toEqual(staking.strk._address);

    expect(await strikeBalance(staking, staking._address)).toEqualNumber(0);
    await send(staking.strk, 'transfer', [staking._address, strikeMinted], {from: root});
    expect(await strikeBalance(staking, staking._address)).toEqualNumber(strikeMinted);
  });

  describe('constructor', () => {
    it("on success it sets admin to creator and pendingAdmin is unset", async () => {
      expect(await call(staking, 'admin')).toEqual(root);
      expect(await call(staking, 'pendingAdmin')).toEqualNumber(0);
    });
  });

  describe('stake', () => {
    it("can not initialize multiple times", async () => {
      await expect(
        send(staking, 'initialize', [staking.strk._address, [root]], {from: root})
      ).rejects.toRevert('revert StrikeStaking:initialize: Already initialized');
    });

    it("only minters can mint", async () => {
      await expect(
        send(staking, 'mint', [root, strikeMinted], {from: accounts[1]})
      ).rejects.toRevert('revert MultiFeeDistribution::mint: Only minters allowed');

      await send(staking, 'mint', [root, strikeMinted], {from: root});
      expect(await call(staking, 'totalSupply')).toEqualNumber(strikeMinted);
      expect(await call(staking, 'totalBalance', [root])).toEqualNumber(strikeMinted);
    });

    it("minter can mint", async () => {
      await send(staking, 'mint', [root, strikeMinted], {from: root});
      expect(await call(staking, 'totalSupply')).toEqualNumber(strikeMinted);
      expect(await call(staking, 'totalBalance', [root])).toEqualNumber(strikeMinted);

      const lockedBalances = await call(staking, 'lockedBalances', [root]);
      expect(lockedBalances.total).toEqualNumber(0);
      expect(lockedBalances.unlockable).toEqualNumber(0);
      expect(lockedBalances.locked).toEqualNumber(0);
      expect(lockedBalances.lockData.length).toEqualNumber(0);

      const withdrawableBalance = await call(staking, 'withdrawableBalance', [root]);
      const strikeMintedBN = new BigNumber(strikeMinted);

      expect(withdrawableBalance.amount).toEqualNumber(strikeMintedBN.dividedBy(2));
      expect(withdrawableBalance.penaltyAmount).toEqualNumber(strikeMintedBN.dividedBy(2));
    });

    it("can not stake less than zero, only lock enabled", async () => {
      await expect(
        send(staking, 'stake', [0, true])
      ).rejects.toRevert('revert MultiFeeDistribution::stake: Cannot stake 0');

      await expect(
        send(staking, 'stake', [strikeMinted, false])
      ).rejects.toRevert('revert Only lock enabled');
    });

    it("user able to stake", async () => {
      await send(staking.strk, 'approve', [staking._address, strikeMinted], {from: root});
      await send(staking, 'stake', [strikeMinted, true], {from: root});

      expect(await call(staking, 'totalSupply')).toEqualNumber(strikeMinted);
      expect(await call(staking, 'totalBalance', [root])).toEqualNumber(strikeMinted);

      const lockedBalances = await call(staking, 'lockedBalances', [root]);
      expect(lockedBalances.total).toEqualNumber(strikeMinted);
      expect(lockedBalances.unlockable).toEqualNumber(0);
      expect(lockedBalances.locked).toEqualNumber(strikeMinted);
      expect(lockedBalances.lockData[0].amount).toEqualNumber(strikeMinted);

      const withdrawableBalance = await call(staking, 'withdrawableBalance', [root]);
      expect(withdrawableBalance.amount).toEqualNumber(0);
      expect(withdrawableBalance.penaltyAmount).toEqualNumber(0);
    });

    it("user able to withdraw after mint", async () => {
      await send(staking, 'mint', [root, strikeMinted], {from: root});
      
      const preBalance = new BigNumber(await strikeBalance(staking, root));
      await send(staking, 'withdraw', [withdrawAmount], {from: root});
      const postBalance = new BigNumber(await strikeBalance(staking, root));

      const withdrawnAmount = postBalance.minus(preBalance);

      expect(withdrawnAmount).toEqualNumber(withdrawAmount);
      
      const lockedBalances = await call(staking, 'lockedBalances', [root]);
      expect(lockedBalances.total).toEqualNumber(0);
      expect(lockedBalances.unlockable).toEqualNumber(0);
      expect(lockedBalances.locked).toEqualNumber(0);
      expect(lockedBalances.lockData.length).toEqualNumber(0);

      const withdrawableBalance = await call(staking, 'withdrawableBalance', [root]);
      expect(withdrawableBalance.amount).toEqualNumber(estimatedLeftAmount);
      expect(withdrawableBalance.penaltyAmount).toEqualNumber(estimatedLeftPenaltyAmount);

    });
  });
});
