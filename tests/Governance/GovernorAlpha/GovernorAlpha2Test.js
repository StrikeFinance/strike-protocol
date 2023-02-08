const {
  advanceBlocks,
  etherUnsigned,
  both,
  encodeParameters,
  etherMantissa,
  mineBlock,
  freezeTime,
  increaseTime
} = require('../../Utils/Ethereum');

const {
  makeSToken,
} = require("../../Utils/Strike");

const path = require('path');
const solparse = require('solparse');

const governorAlphaPath = path.join(__dirname, '../../..', 'contracts', 'Governance/GovernorAlpha2.sol');

const statesInverted = solparse
  .parseFile(governorAlphaPath)
  .body
  .find(k => k.type === 'ContractStatement')
  .body
  .find(k => k.name == 'ProposalState')
  .members

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

describe('GovernorAlpha2', () => {
  let strk, gov, root, acct, receiver, delay, timelock;

  beforeAll(async () => {
    await freezeTime(100);
    [root, acct, receiver, ...accounts] = accounts;
    strk = await deploy('STRK', [root]);
    delay = etherUnsigned(2 * 24 * 60 * 60).mul(2)
    timelock = await deploy('TimelockHarness', [root, delay]);
    gov = await deploy('GovernorAlpha2', [timelock._address, strk._address, root, 0]);
    await send(timelock, "harnessSetAdmin", [gov._address])
    await send(strk, 'delegate', [root]);
    await send(strk, 'transfer', [acct, etherMantissa(260753)]);
    await send(strk, 'delegate', [acct], { from: acct });
  });

  let targets, values, signatures, callDatas;
  let sToken;
  beforeAll(async () => {
    sToken = await makeSToken({ kind: 'sether', admin: timelock._address, comptrollerOpts: {kind: 'bool'} });
    await send(sToken, 'mint', [], {from: root, value: etherUnsigned(50e18)});
    expect(
      await send(sToken, "harnessSetTotalReserves", [etherUnsigned(30e18)])
    ).toSucceed();

    targets = [sToken._address, receiver];
    values = ["0", etherUnsigned(30e18)];
    signatures = ["_reduceReserves(uint256)", "call()"]
    callDatas = [encodeParameters(["uint256"], [etherUnsigned(30e18)]), []];
  })

  it("Withdraw Eth reserve", async () => {
    await mineBlock()
    const { reply: newProposalId } = await both(gov, 'propose', [targets, values, signatures, callDatas, "Withdraw ETH Reserve"], { from: acct })
    await mineBlock()
    await send(gov, 'castVote', [newProposalId, true])
    await advanceBlocks(20000)

    await increaseTime(1)
    await send(gov, 'queue', [newProposalId], { from: acct })

    let gracePeriod = await call(timelock, 'GRACE_PERIOD')
    let p = await call(gov, "proposals", [newProposalId]);
    let eta = etherUnsigned(p.eta)

    await freezeTime(eta.add(gracePeriod).sub(1).toNumber())

    expect(await call(gov, 'state', [newProposalId])).toEqual(states["Queued"])
    await send(gov, 'execute', [newProposalId], { from: acct })

    expect(await call(gov, 'state', [newProposalId])).toEqual(states["Executed"])

    // still executed even though would be expired
    await freezeTime(eta.add(gracePeriod).toNumber())

    expect(await call(gov, 'state', [newProposalId])).toEqual(states["Executed"])

    expect(await web3.eth.getBalance(receiver)).toEqual(etherUnsigned(130e18).toString())
  })
})