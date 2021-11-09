const { default: BigNumber } = require('bignumber.js');
const {
  address,
  minerStart,
  minerStop,
  unlockedAccount,
  mineBlock,
  increaseTime,
  etherExp,
  etherUnsigned
} = require('../Utils/Ethereum');

describe('Team Treasury', () => {
  let root, a1, a2, accounts, chainId;
  let CHNToken;
  let initAmount = etherUnsigned(1e25);
  let periodAmount = etherUnsigned(25e22);
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
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(periodAmount.toString());
    await increaseTime(period * 3.5);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(periodAmount.mul(4).toString());
    await increaseTime(period * 0.4);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(periodAmount.mul(4).toString());

    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber("0");

    // check withdraw

    await expect(
      send(treasuryContract, 'withdrawAllUnlockToken', [], {from: a1})
    ).rejects.toRevert("revert NO PERMISSION");

    await send(treasuryContract, 'withdrawAllUnlockToken', [], {from: root});
    
    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber(periodAmount.mul(4).toString());
    expect(await call(CHNToken, 'balanceOf', [treasuryContract._address])).toEqualNumber(initAmount.sub(periodAmount.mul(4)).toString());
    
    await expect(
      send(treasuryContract, 'withdrawAllUnlockToken', [], {from: root})
    ).rejects.toRevert("revert INVALID AMOUNT");

    expect(await call(CHNToken, 'balanceOf', [root])).toEqualNumber(periodAmount.mul(4).toString());


    await increaseTime(period * 0.2);
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(periodAmount.toString());
    await send(treasuryContract, 'withdrawAllUnlockToken', [], {from: root});
    expect(await call(treasuryContract, 'getClaimedAmount', [], {from: root})).toEqualNumber(periodAmount.mul(5).toString());
    expect(await call(treasuryContract, 'getUnlockedAmount', [], {from: root})).toEqualNumber("0");

    // period > 40 period => unlock amount = initAmount - claimAmount
    await increaseTime(period * 42);
    expect(await call(treasuryContract, 'getClaimedAmount', [], {from: root})).toEqualNumber(periodAmount.mul(5).toString());
    expect(await call(treasuryContract, 'getUnlockedAmount', [])).toEqual(initAmount.sub(periodAmount.mul(5)).toString());
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
