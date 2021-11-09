const { default: BigNumber } = require('bignumber.js');
const {
  address,
  minerStart,
  minerStop,
  unlockedAccount,
  mineBlock,
  increaseTime
} = require('../Utils/Ethereum');

describe('Team Treasury', () => {
  let root, a1, a2, accounts, chainId;
  let CHNToken;
  let initAmount = '10000000000000000000000000';
  let periodAmount = "250000000000000000000000";
  let period = 30 * 24 * 60 * 60;

  it('check amount token', async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
    CHNToken = await deploy('StandardToken', [initAmount, "CHN", 18, "CHN"], {from: root});
    const treasuryContract = await deploy('TeamTreasure', [CHNToken._address], {from: root});
    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber(initAmount);
    await send(CHNToken, 'transfer', [treasuryContract._address, initAmount]);
    const balanceTreasury = await call(CHNToken, 'balanceOf', [treasuryContract._address]);
    expect(await call(CHNToken, 'balanceOf', [treasuryContract._address])).toEqualNumber(initAmount);

    // check unlock amount token
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual("0");
    await increaseTime(period - 100);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual("0");
    await increaseTime(100);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(periodAmount);
    await increaseTime(period * 3.5);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual("1000000000000000000000000");
    await increaseTime(period * 0.4);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual("1000000000000000000000000");

    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber("0");

    // check withdraw

    await expect(
      send(treasuryContract, 'withdrawAllUnlockToken', [], {from: a1})
    ).rejects.toRevert("revert NO PERMISSION");

    await send(treasuryContract, 'withdrawAllUnlockToken', [], {from: root});
    
    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber("1000000000000000000000000");
    expect(await call(CHNToken, 'balanceOf', [treasuryContract._address])).toEqualNumber("9000000000000000000000000");
    
    await expect(
      send(treasuryContract, 'withdrawAllUnlockToken', [], {from: root})
    ).rejects.toRevert("revert INVALID AMOUNT");

    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber("1000000000000000000000000");

    // period > 40 period => unlock amount = initAmount - claimAmount
    await increaseTime(period * 42);
    expect(await call(treasuryContract, 'getClaimedAmount', [], {from: root})).toEqualNumber("1000000000000000000000000");
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual("9000000000000000000000000");
  });


  it('changeOwner', async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
    CHNToken = await deploy('StandardToken', [initAmount, "CHN", 18, "CHN"], {from: root});
    const treasuryContract = await deploy('TeamTreasure', [CHNToken._address], {from: root});
    expect(await call(treasuryContract, 'getOwner', [])).toEqual(root);
    await expect(
      send(treasuryContract, 'changeOwner', [a2], {from: a1})
    ).rejects.toRevert("revert NO PERMISSION");
    await send(treasuryContract, 'changeOwner', [a2], {from: root})
    expect(await call(treasuryContract, 'getOwner', [])).toEqual(a2);
  });

});
