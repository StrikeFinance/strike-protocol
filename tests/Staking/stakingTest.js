const { default: BigNumber } = require('bignumber.js');
const {
  etherUnsigned,
  increaseTime
} = require('../Utils/Ethereum');

const {
  makeStaking,
  balanceOf,
  fastForward,
  preApprove
} = require('../Utils/Strike');

const {address} = require('../Utils/Ethereum');

async function strikeBalance(staking, user) {
  return etherUnsigned(await call(staking.strk, 'balanceOf', [user]))
}

const QUART = 25000; //  25%
const HALF = 65000; //  65%
const WHOLE = 100000; // 100%
const lockDuration = 86400 * 14 * 6;

describe('Staking', () => {
  let root, accounts;
  let staking;
  const strikeMinted = etherUnsigned(1e18).mul(1000);
  const withdrawAmount = etherUnsigned(1e18).mul(100);

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

      const earnedBalances = await call(staking, 'earnedBalances', [root]);
      const penaltyFactor =
        parseInt((earnedBalances.earningsData[0].unlockTime - parseInt(new Date().getTime() / 1000)) * HALF / lockDuration + QUART)
      const penaltyAmount = strikeMintedBN.times(penaltyFactor).div(WHOLE).dp(0, 3);

      expect(withdrawableBalance.amount).toEqualNumber(strikeMintedBN.minus(penaltyAmount));
      expect(withdrawableBalance.penaltyAmount).toEqualNumber(penaltyAmount);
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

      const earnedBalances = await call(staking, 'earnedBalances', [root]);
      const penaltyFactor =
        parseInt((earnedBalances.earningsData[0].unlockTime - parseInt(new Date().getTime() / 1000)) * HALF / lockDuration + QUART)
      const earnedBN = new BigNumber(earnedBalances.earningsData[0].amount);
      const penaltyAmount = earnedBN.times(penaltyFactor).div(WHOLE).dp(0, 3);
      expect(withdrawableBalance.amount).toEqualNumber(earnedBN.minus(penaltyAmount));
      expect(withdrawableBalance.penaltyAmount).toEqualNumber(penaltyAmount);
    });

    it("user claim reward after withdrawal expired locks", async () => {
      const lockAmount = etherUnsigned(1e18).mul(1000);
      const notifyAmount = etherUnsigned(1e18).mul(86400 * 14);

      await send(staking.strk, 'approve', [staking._address, notifyAmount.mul(2)], {from: root});
      await send(staking, 'stake', [lockAmount, true], {from: root});

      // Approve as distributor
      await send(staking, 'approveRewardDistributor', [staking.strk._address, root, true]);

      await send(staking, 'notifyRewardAmount', [staking.strk._address, notifyAmount]);

      await increaseTime(86400 * 14 * 6);

      const lockedBalances = await call(staking, 'lockedBalances', [root]);
      expect(lockedBalances.unlockable).toEqualNumber(lockAmount);

      const claimableRewards = await call(staking, 'claimableRewards', [root]);
      expect(claimableRewards[0].amount).toEqualNumber(notifyAmount);

      await send(staking, 'withdrawExpiredLocks', []);

      const lockedBalances1 = await call(staking, 'lockedBalances', [root]);
      expect(lockedBalances1.unlockable).toEqualNumber(0);

      const claimableRewards1 = await call(staking, 'claimableRewards', [root]);
      expect(claimableRewards1[0].amount).toEqualNumber(notifyAmount);

      const balanceBefore = await strikeBalance(staking, root)
      await send(staking, 'getReward', []);
      const balanceAfter = await strikeBalance(staking, root)
      expect(balanceAfter).toEqualNumber(balanceBefore.add(notifyAmount));

      const claimableRewards2 = await call(staking, 'claimableRewards', [root]);
      expect(claimableRewards2[0].amount).toEqualNumber(0);
    });
  });

  describe('_acceptAdminInImplementation()', () => {
    it('should fail when pending admin is zero', async () => {
      await expect(send(staking, '_acceptAdminInImplementation')).rejects.toRevert('revert ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

      // Check admin stays the same
      expect(await call(staking, 'admin')).toEqual(root);
      expect(await call(staking, 'pendingAdmin')).toBeAddressZero();
    });

    it('should fail when called by another account (e.g. root)', async () => {
      expect(await send(staking, '_setPendingAdmin', [accounts[0]])).toSucceed();
      await expect(send(staking, '_acceptAdminInImplementation')).rejects.toRevert('revert ACCEPT_ADMIN_PENDING_ADMIN_CHECK');

      // Check admin stays the same
      expect(await call(staking, 'admin')).toEqual(root);
      expect(await call(staking, 'pendingAdmin')).toEqual(accounts[0]);
    });

    it('should succeed and set admin and clear pending admin', async () => {
      expect(await send(staking, '_setPendingAdmin', [accounts[0]])).toSucceed();
      expect(await send(staking, '_acceptAdminInImplementation', [], {from: accounts[0]})).toSucceed();

      // Check admin stays the same
      expect(await call(staking, 'admin')).toEqual(accounts[0]);
      expect(await call(staking, 'pendingAdmin')).toBeAddressZero();
    });

    it('should emit log on success', async () => {
      expect(await send(staking, '_setPendingAdmin', [accounts[0]])).toSucceed();
      const result = await send(staking, '_acceptAdminInImplementation', [], {from: accounts[0]});
      expect(result).toHaveLog('NewAdmin', {
        oldAdmin: root,
        newAdmin: accounts[0],
      });
      expect(result).toHaveLog('NewPendingAdmin', {
        oldPendingAdmin: accounts[0],
        newPendingAdmin: address(0),
      });
    });
  });
});

describe('Staking-Blacklist', () => {
  let root, blacklistedUser, alice, accounts;
  let staking;
  const strikeMinted = etherUnsigned(1e18).mul(1000);
  const withdrawAmount = etherUnsigned(1e18).mul(100);
  const halfAmount = etherUnsigned(1e18).mul(500);
  const rewardAmount = etherUnsigned(1e18).mul(864 * 14);

  beforeAll(async () => {
    [root, blacklistedUser, alice, ...accounts] = saddle.accounts;
    staking = await makeStaking();

    expect(await call(staking, 'owner')).toEqual(root);
    expect(await call(staking, 'admin')).toEqual(root);

    await send(staking, 'initialize', [staking.strk._address, [root]], {from: root});

    expect(await call(staking, 'stakingToken')).toEqual(staking.strk._address);

    expect(await strikeBalance(staking, staking._address)).toEqualNumber(0);
    await send(staking.strk, 'transfer', [staking._address, strikeMinted], {from: root});
    expect(await strikeBalance(staking, staking._address)).toEqualNumber(strikeMinted);

    // transfer STRK to blacklisted user
    await send(staking.strk, 'transfer', [blacklistedUser, strikeMinted.mul(2)], {from: root});
  });

  it("blacklisted user can't stake", async () => {
    await send(staking.strk, 'approve', [staking._address, strikeMinted.mul(2)], {from: blacklistedUser});
    await send(staking, 'stake', [strikeMinted, true], {from: blacklistedUser});

    expect(await call(staking, 'totalSupply')).toEqualNumber(strikeMinted);
    expect(await call(staking, 'totalBalance', [blacklistedUser])).toEqualNumber(strikeMinted);

    const lockedBalances = await call(staking, 'lockedBalances', [blacklistedUser]);
    expect(lockedBalances.total).toEqualNumber(strikeMinted);
    expect(lockedBalances.unlockable).toEqualNumber(0);
    expect(lockedBalances.locked).toEqualNumber(strikeMinted);
    expect(lockedBalances.lockData[0].amount).toEqualNumber(strikeMinted);

    const withdrawableBalance = await call(staking, 'withdrawableBalance', [blacklistedUser]);
    expect(withdrawableBalance.amount).toEqualNumber(0);
    expect(withdrawableBalance.penaltyAmount).toEqualNumber(0);

    // set blacklist
    await send(staking, 'setBlacklist', [blacklistedUser], {from: blacklistedUser});

    await expect(send(staking, 'stake', [strikeMinted, true], {from: blacklistedUser})).rejects.toRevert('revert Blacklisted');
  });

  it("blacklisted user can't mint", async () => {
    await expect(send(staking, 'mint', [blacklistedUser, strikeMinted], {from: root})).rejects.toRevert('revert Blacklisted');
  });

  it("blacklisted user can't withdraw", async () => {
    await send(staking, 'setBlacklist', [alice]);
    await send(staking, 'mint', [blacklistedUser, strikeMinted], {from: root});

    await send(staking, 'setBlacklist', [blacklistedUser], {from: blacklistedUser});

    await expect(send(staking, 'withdraw', [withdrawAmount], {from: blacklistedUser})).rejects.toRevert('revert Blacklisted');
    await expect(send(staking, 'emergencyWithdraw', [], {from: blacklistedUser})).rejects.toRevert('revert Blacklisted');
  });

  it("blacklisted user can't get reward", async () => {
    await expect(send(staking, 'getReward', [], {from: blacklistedUser})).rejects.toRevert('revert Blacklisted');
  });

  it("blacklisted user can't unlock", async () => {
    await expect(send(staking, 'withdrawExpiredLocks', [], {from: blacklistedUser})).rejects.toRevert('revert Blacklisted');
  });

  it("distributor can remove locks of blacklisted user", async () => {
    // pass time by 12 weeks
    await increaseTime(86400 * 7 * 12)

    const lockedBalances = await call(staking, 'lockedBalances', [blacklistedUser]);
    expect(lockedBalances.unlockable).toEqualNumber(strikeMinted);

    await expect(send(staking, 'removeBlacklistedLocks', [alice, staking.strk._address, accounts[0]], {from: alice})).rejects.toRevert('revert No blacklisted');

    // set alice as distributor
    await send(staking, 'approveRewardDistributor', [staking.strk._address, alice, true]);

    await send(staking.strk, 'transfer', [alice, rewardAmount], {from: root});
    await send(staking.strk, 'approve', [staking._address, rewardAmount], {from: alice});
    await send(staking, 'notifyRewardAmount', [staking.strk._address, rewardAmount], {from: alice});

    await increaseTime(86400 * 7 * 2);

    await expect(send(staking, 'removeBlacklistedLocks', [blacklistedUser, staking.strk._address, accounts[0]], {from: root})).rejects.toRevert('revert MultiFeeDistribution::removeBlacklistedLocks: Only reward distributors allowed');
    await send(staking, 'removeBlacklistedLocks', [blacklistedUser, staking.strk._address, accounts[0]], {from: alice});

    // balance should be sum of locked amount and reward amount
    expect(await strikeBalance(staking, accounts[0])).toEqualNumber(strikeMinted.add(rewardAmount));
  });
});
