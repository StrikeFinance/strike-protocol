"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  etherBalance,
  etherMantissa,
  etherUnsigned,
  mergeInterface
} = require('./Ethereum');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    return await deploy('BoolComptroller');
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setMaxAssets', [maxAssets]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller-g3') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const strikeRate = etherUnsigned(dfn(opts.strikeRate, 1e18));
    const strikeMarkets = opts.strikeMarkets || [];
    const otherMarkets = opts.otherMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address, strikeRate, strikeMarkets, otherMarkets]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const strk = opts.strk || await deploy('STRK', [opts.strkOwner || root]);
    const strikeRate = etherUnsigned(dfn(opts.strikeRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setSTRKAddress', [strk._address]); // harness only
    await send(unitroller, '_setStrikeRate', [strikeRate]);

    return Object.assign(unitroller, { priceOracle, strk });
  }
}

async function makeSToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'serc20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
  const decimals = etherUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'sether' ? 'sETH' : 'cOMG');
  const name = opts.name || `SToken ${symbol}`;
  const admin = opts.admin || root;

  let sToken, underlying;
  let sDelegator, sDelegatee, sDaiMaker;

  switch (kind) {
    case 'sether':
      sToken = await deploy('SEtherHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'sdai':
      sDaiMaker  = await deploy('SDaiDelegateMakerHarness');
      underlying = sDaiMaker;
      sDelegatee = await deploy('SDaiDelegateHarness');
      sDelegator = await deploy('SErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          sDelegatee._address,
          encodeParameters(['address', 'address'], [sDaiMaker._address, sDaiMaker._address])
        ]
      );
      sToken = await saddle.getContractAt('SDaiDelegateHarness', sDelegator._address); // XXXS at
      break;

    case 'sstrk':
      underlying = await deploy('STRK', [opts.compHolder || root]);
      sDelegatee = await deploy('SStrkLikeDelegate');
      sDelegator = await deploy('SErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          sDelegatee._address,
          "0x0"
        ]
      );
      sToken = await saddle.getContractAt('SStrkLikeDelegate', sDelegator._address);
      break;

    case 'serc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      sDelegatee = await deploy('SErc20DelegateHarness');
      sDelegator = await deploy('SErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          sDelegatee._address,
          "0x0"
        ]
      );
      sToken = await saddle.getContractAt('SErc20DelegateHarness', sDelegator._address); // XXXS at
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [sToken._address]);
  }

  if (opts.addStrikeMarket) {
    await send(comptroller, '_addStrikeMarket', [sToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [sToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [sToken._address, factor])).toSucceed();
  }

  return Object.assign(sToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return etherUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return etherUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(sToken, account) {
  const { principal, interestIndex } = await call(sToken, 'harnessAccountBorrows', [account]);
  return { principal: etherUnsigned(principal), interestIndex: etherUnsigned(interestIndex) };
}

async function totalBorrows(sToken) {
  return etherUnsigned(await call(sToken, 'totalBorrows'));
}

async function totalReserves(sToken) {
  return etherUnsigned(await call(sToken, 'totalReserves'));
}

async function enterMarkets(sTokens, from) {
  return await send(sTokens[0].comptroller, 'enterMarkets', [sTokens.map(c => c._address)], { from });
}

async function fastForward(sToken, blocks = 5) {
  return await send(sToken, 'harnessFastForward', [blocks]);
}

async function setBalance(sToken, account, balance) {
  return await send(sToken, 'harnessSetBalance', [account, balance]);
}

async function setEtherBalance(sEther, balance) {
  const current = await etherBalance(sEther._address);
  const root = saddle.account;
  expect(await send(sEther, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(sEther, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(sTokens, accounts) {
  const balances = {};
  for (let sToken of sTokens) {
    const cBalances = balances[sToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        eth: await etherBalance(account),
        cash: sToken.underlying && await balanceOf(sToken.underlying, account),
        tokens: await balanceOf(sToken, account),
        borrows: (await borrowSnapshot(sToken, account)).principal
      };
    }
    cBalances[sToken._address] = {
      eth: await etherBalance(sToken._address),
      cash: sToken.underlying && await balanceOf(sToken.underlying, sToken._address),
      tokens: await totalSupply(sToken),
      borrows: await totalBorrows(sToken),
      reserves: await totalReserves(sToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let sToken, account, key, diff;
    if (delta.length == 4) {
      ([sToken, account, key, diff] = delta);
    } else {
      ([sToken, key, diff] = delta);
      account = sToken._address;
    }
    balances[sToken._address][account][key] = balances[sToken._address][account][key].add(diff);
  }
  return balances;
}


async function preApprove(sToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(sToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(sToken.underlying, 'approve', [sToken._address, amount], { from });
}

async function quickMint(sToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(sToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(sToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(sToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(sToken, 'mint', [mintAmount], { from: minter });
}


async function preSupply(sToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(sToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(sToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(sToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(sToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(sToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(sToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(sToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(sToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(sToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(sToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(sToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(sToken, price) {
  return send(sToken.comptroller.priceOracle, 'setUnderlyingPrice', [sToken._address, etherMantissa(price)]);
}

async function setBorrowRate(sToken, rate) {
  return send(sToken.interestRateModel, 'setBorrowRate', [etherMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(etherUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(etherUnsigned));
}

async function pretendBorrow(sToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(sToken, 'harnessSetTotalBorrows', [etherUnsigned(principalRaw)]);
  await send(sToken, 'harnessSetAccountBorrows', [borrower, etherUnsigned(principalRaw), etherMantissa(accountIndex)]);
  await send(sToken, 'harnessSetBorrowIndex', [etherMantissa(marketIndex)]);
  await send(sToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(sToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeSToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
