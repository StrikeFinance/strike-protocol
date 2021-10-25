let { loadConf } = require('./support/tokenConfig');

function printUsage() {
  console.log(``);
}

function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

(async function() {

  const msgSender = '0xCB2d2B86EE7009B0589d529989504D8f2291BeaD';
  let timeLockDelay = '345600';
  let baseRatePerYear = '20000000000000000';
  let multiplierPerYear = '300000000000000000';

  let strike = await saddle.deploy('STRK', [msgSender]);
  console.log(`Deployed Strike contract to ${strike._address}`);

  let unitroller = await saddle.deploy('Unitroller');
  console.log(`Deployed Unitroller contract to ${unitroller._address}`);

  
  let comptroller = await saddle.deploy('Comptroller');
  console.log(`Deployed Comptroller contract to ${comptroller._address}`); 
  
  //todo: unitroller need set comptroller address here
  // await unitroller._setPendingImplementation(comptroller._address);

  let strikePriceOracle = await saddle.deploy('StrikePriceOracle');
  console.log(`Deployed StrikePriceOracle contract to ${strikePriceOracle._address}`);

  //todo: set price oracle for comptroller
  // await comptroller._setPriceOracle(strikePriceOracle._address);

  //todo: set _setStrikeSpeed
  
  let timelock = await saddle.deploy('Timelock', [msgSender, timeLockDelay]);
  console.log(`Deployed Timelock contract to ${timelock._address}`);
  
  let gorvermentAlpha = await saddle.deploy('GovernorAlpha', [timelock._address, strike._address, msgSender]);
  console.log(`Deployed GovernorAlpha contract to ${gorvermentAlpha._address}`);


  let whitePaperInterest = await saddle.deploy('WhitePaperInterestRateModel', [baseRatePerYear, multiplierPerYear]);
  console.log(`Deployed WhitePaperInterestRateModel contract to ${whitePaperInterest._address}`);
  
  
  
  deployArgsSStrike = [
    strike._address,
    comptroller._address,
    whitePaperInterest._address,
    "200000000000000000000000000",
    "Strike Kyber Network Crystal",
    "sSTRK",
    "8",
    timelock._address
  ]
  let sStrike = await saddle.deploy('SErc20Immutable', deployArgsSStrike);
  console.log(`Deployed SStrike contract to ${sStrike._address}`);


  if (env['VERIFY']) {
    const etherscanApiKey = env['ETHERSCAN_API_KEY'];
    if (etherscanApiKey === undefined || etherscanApiKey.length === 0) {
      throw new Error(`ETHERSCAN_API_KEY must be set if using VERIFY flag...`);
    }

    console.log(`Sleeping for 30 seconds then verifying contract on Etherscan...`);
    await sleep(30000); // Give Etherscan time to learn about contract
    console.log(`Now verifying contract on Etherscan...`);
    await saddle.verify(etherscanApiKey, strike._address, 'STRK', [msgSender], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, unitroller._address, 'Unitroller', [], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, comptroller._address, 'Comptroller', [], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, timelock._address, 'Timelock', [msgSender, timeLockDelay], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, gorvermentAlpha._address, 'GovernorAlpha', [timelock._address, strike._address, msgSender], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, whitePaperInterest._address, 'WhitePaperInterestRateModel', [baseRatePerYear, multiplierPerYear], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, strikePriceOracle._address, 'StrikePriceOracle', [], 0);
    await sleep(3000);
    await saddle.verify(etherscanApiKey, sStrike._address, 'SErc20Immutable', deployArgsSStrike , 0);


    console.log(`Contract STRK verified at https://${network}.etherscan.io/address/${strike._address}`);
    console.log(`Contract Unitroller verified at https://${network}.etherscan.io/address/${unitroller._address}`);
    console.log(`Contract Comptroller verified at https://${network}.etherscan.io/address/${comptroller._address}`);
    console.log(`Contract Timelock verified at https://${network}.etherscan.io/address/${timelock._address}`);
    console.log(`Contract GovernorAlpha verified at https://${network}.etherscan.io/address/${gorvermentAlpha._address}`);
    console.log(`Contract WhitePaperInterestRateModel verified at https://${network}.etherscan.io/address/${whitePaperInterest._address}`);
    console.log(`Contract StrikePriceOracle verified at https://${network}.etherscan.io/address/${strikePriceOracle._address}`);
    console.log(`Contract SStrike verified at https://${network}.etherscan.io/address/${sStrike._address}`);
  }

  return {
    address: strike._address
  };
})();
