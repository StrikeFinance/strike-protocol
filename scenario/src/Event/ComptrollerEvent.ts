import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Comptroller} from '../Contract/Comptroller';
import {ComptrollerImpl} from '../Contract/ComptrollerImpl';
import {SToken} from '../Contract/SToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {ComptrollerErrorReporter, STokenErrorReporter} from '../ErrorReporter';
import {getComptroller, getComptrollerImpl} from '../ContractLookup';
import {getLiquidity} from '../Value/ComptrollerValue';
import {getSTokenV} from '../Value/STokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genComptroller(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, comptrollerImpl: comptroller, comptrollerImplData: comptrollerData} = await buildComptrollerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Comptroller (${comptrollerData.description}) at address ${comptroller._address}`,
    comptrollerData.invokation
  );

  return world;
};

async function setPaused(world: World, from: string, comptroller: Comptroller, actionName: string, isPaused: boolean): Promise<World> {
  const pauseMap = {
    "Mint": comptroller.methods._setMintPaused
  };

  if (!pauseMap[actionName]) {
    throw `Cannot find pause function for action "${actionName}"`;
  }

  let invokation = await invoke(world, comptroller[actionName]([isPaused]), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: set paused for ${actionName} to ${isPaused}`,
    invokation
  );

  return world;
}

async function setMaxAssets(world: World, from: string, comptroller: Comptroller, numberOfAssets: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMaxAssets(numberOfAssets.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set max assets to ${numberOfAssets.show()}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, comptroller: Comptroller, liquidationIncentive: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, comptroller: Comptroller, sToken: SToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${sToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(sToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${sToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, comptroller: Comptroller, sToken: SToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.unlist(sToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${sToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, comptroller: Comptroller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.enterMarkets(assets), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, comptroller: Comptroller, asset: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.exitMarket(asset), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setPriceOracle(world: World, from: string, comptroller: Comptroller, priceOracleAddr: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPriceOracle(priceOracleAddr), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, comptroller: Comptroller, sToken: SToken, collateralFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCollateralFactor(sToken._address, collateralFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${sToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, comptroller: Comptroller, closeFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCloseFactor(closeFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function fastForward(world: World, from: string, comptroller: Comptroller, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.fastForward(blocks.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, comptroller: Comptroller, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: comptroller._address,
      data: fnData,
      from: from
    })
  return world;
}

async function addStrikeMarkets(world: World, from: string, comptroller: Comptroller, sTokens: SToken[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._addStrikeMarkets(sTokens.map(c => c._address)), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Added STRK markets ${sTokens.map(c => c.name)}`,
    invokation
  );

  return world;
}

async function dropStrikeMarket(world: World, from: string, comptroller: Comptroller, sToken: SToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._dropStrikeMarket(sToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Drop STRK market ${sToken.name}`,
    invokation
  );

  return world;
}

async function refreshStrikeSpeeds(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.refreshStrikeSpeeds(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Refreshed STRK speeds`,
    invokation
  );

  return world;
}

async function setStrikeSpeed(world: World, from: string, comptroller: Comptroller, sToken: SToken, speed: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setStrikeSpeed(sToken._address, speed.encode()), from, ComptrollerErrorReporter);
  
  world = addAction(
    world,
    `Strike speed for market ${sToken._address} set to ${speed.show()}`,
    invokation
  );

  return world;
}

async function claimStrike(world: World, from: string, comptroller: Comptroller, holder: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.claimStrike(holder), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `STRK claimed by ${holder}`,
    invokation
  );

  return world;
}

async function updateContributorRewards(world: World, from: string, comptroller: Comptroller, contributor: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.updateContributorRewards(contributor), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Contributor rewards updated for ${contributor}`,
    invokation
  );

  return world;
}

async function grantSTRK(world: World, from: string, comptroller: Comptroller, recipient: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._grantSTRK(recipient, amount.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `${amount.show()} strk granted to ${recipient}`,
    invokation
  );

  return world;
}

async function setContributorStrikeSpeed(world: World, from: string, comptroller: Comptroller, contributor: string, strikeSpeed: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setContributorStrikeSpeed(contributor, strikeSpeed.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set Contributor Strike Speed for ${contributor} as ${strikeSpeed.show()}`,
    invokation
  );

  return world;
}

async function setStrikeRate(world: World, from: string, comptroller: Comptroller, rate: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setStrikeRate(rate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `STRK rate set to ${rate.show()}`,
    invokation
  );

  return world;
}

async function setStrikeSpeeds(world: World, from: string, comptroller: Comptroller, sTokens: SToken[], supplySpeeds: NumberV[], borrowSpeeds: NumberV[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setStrikeSpeeds(sTokens.map(c => c._address), supplySpeeds.map(speed => speed.encode()), borrowSpeeds.map(speed => speed.encode())), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comp speed for markets [${sTokens.map(c => c._address)}] set to supplySpeeds=[${supplySpeeds.map(speed => speed.show())}, borrowSpeeds=[${borrowSpeeds.map(speed => speed.show())}]`,
    invokation
  );

  return world;
}

async function printLiquidity(world: World, comptroller: Comptroller): Promise<World> {
  let enterEvents = await getPastEvents(world, comptroller, 'StdComptroller', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

async function setPendingAdmin(world: World, from: string, comptroller: Comptroller, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPendingAdmin(newPendingAdmin), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._acceptAdmin(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setPauseGuardian(world: World, from: string, comptroller: Comptroller, newPauseGuardian: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPauseGuardian(newPauseGuardian), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pause guardian to ${newPauseGuardian}`,
    invokation
  );

  return world;
}

async function setGuardianPaused(world: World, from: string, comptroller: Comptroller, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Transfer":
      fun = comptroller.methods._setTransferPaused
      break;
    case "Seize":
      fun = comptroller.methods._setSeizePaused
      break;
  }
  let invokation = await invoke(world, fun(state), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

async function setGuardianMarketPaused(world: World, from: string, comptroller: Comptroller, sToken: SToken, action: string, state: boolean): Promise<World> {
  let fun;
  switch(action){
    case "Mint":
      fun = comptroller.methods._setMintPaused
      break;
    case "Borrow":
      fun = comptroller.methods._setBorrowPaused
      break;
  }
  let invokation = await invoke(world, fun(sToken._address, state), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets ${action} paused`,
    invokation
  );

  return world;
}

export function comptrollerCommands() {
  return [
    new Command<{comptrollerParams: EventV}>(`
        #### Deploy

        * "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller (not as Impl)
          * E.g. "Comptroller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("comptrollerParams", getEventV, {variadic: true})],
      (world, from, {comptrollerParams}) => genComptroller(world, from, comptrollerParams.val)
    ),
    new Command<{comptroller: Comptroller, action: StringV, isPaused: BoolV}>(`
        #### SetPaused

        * "Comptroller SetPaused <Action> <Bool>" - Pauses or unpaused given sToken function
          * E.g. "Comptroller SetPaused "Mint" True"
      `,
      "SetPaused",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("action", getStringV),
        new Arg("isPaused", getBoolV)
      ],
      (world, from, {comptroller, action, isPaused}) => setPaused(world, from, comptroller, action.val, isPaused.val)
    ),
    new Command<{comptroller: Comptroller, sToken: SToken}>(`
        #### SupportMarket

        * "Comptroller SupportMarket <SToken>" - Adds support in the Comptroller for the given sToken
          * E.g. "Comptroller SupportMarket sZRX"
      `,
      "SupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sToken", getSTokenV)
      ],
      (world, from, {comptroller, sToken}) => supportMarket(world, from, comptroller, sToken)
    ),
    new Command<{comptroller: Comptroller, sToken: SToken}>(`
        #### UnList

        * "Comptroller UnList <SToken>" - Mock unlists a given market in tests
          * E.g. "Comptroller UnList sZRX"
      `,
      "UnList",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sToken", getSTokenV)
      ],
      (world, from, {comptroller, sToken}) => unlistMarket(world, from, comptroller, sToken)
    ),
    new Command<{comptroller: Comptroller, sTokens: SToken[]}>(`
        #### EnterMarkets

        * "Comptroller EnterMarkets (<SToken> ...)" - User enters the given markets
          * E.g. "Comptroller EnterMarkets (sZRX sETH)"
      `,
      "EnterMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sTokens", getSTokenV, {mapped: true})
      ],
      (world, from, {comptroller, sTokens}) => enterMarkets(world, from, comptroller, sTokens.map((c) => c._address))
    ),
    new Command<{comptroller: Comptroller, sToken: SToken}>(`
        #### ExitMarket

        * "Comptroller ExitMarket <SToken>" - User exits the given markets
          * E.g. "Comptroller ExitMarket sZRX"
      `,
      "ExitMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sToken", getSTokenV)
      ],
      (world, from, {comptroller, sToken}) => exitMarket(world, from, comptroller, sToken._address)
    ),
    new Command<{comptroller: Comptroller, maxAssets: NumberV}>(`
        #### SetMaxAssets

        * "Comptroller SetMaxAssets <Number>" - Sets (or resets) the max allowed asset count
          * E.g. "Comptroller SetMaxAssets 4"
      `,
      "SetMaxAssets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("maxAssets", getNumberV)
      ],
      (world, from, {comptroller, maxAssets}) => setMaxAssets(world, from, comptroller, maxAssets)
    ),
    new Command<{comptroller: Comptroller, liquidationIncentive: NumberV}>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Comptroller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberV)
      ],
      (world, from, {comptroller, liquidationIncentive}) => setLiquidationIncentive(world, from, comptroller, liquidationIncentive)
    ),
    new Command<{comptroller: Comptroller, priceOracle: AddressV}>(`
        #### SetPriceOracle

        * "Comptroller SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "Comptroller SetPriceOracle 0x..."
      `,
      "SetPriceOracle",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("priceOracle", getAddressV)
      ],
      (world, from, {comptroller, priceOracle}) => setPriceOracle(world, from, comptroller, priceOracle.val)
    ),
    new Command<{comptroller: Comptroller, sToken: SToken, collateralFactor: NumberV}>(`
        #### SetCollateralFactor

        * "Comptroller SetCollateralFactor <SToken> <Number>" - Sets the collateral factor for given sToken to number
          * E.g. "Comptroller SetCollateralFactor sZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sToken", getSTokenV),
        new Arg("collateralFactor", getExpNumberV)
      ],
      (world, from, {comptroller, sToken, collateralFactor}) => setCollateralFactor(world, from, comptroller, sToken, collateralFactor)
    ),
    new Command<{comptroller: Comptroller, closeFactor: NumberV}>(`
        #### SetCloseFactor

        * "Comptroller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Comptroller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {comptroller, closeFactor}) => setCloseFactor(world, from, comptroller, closeFactor)
    ),
    new Command<{comptroller: Comptroller, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "Comptroller SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the Comptroller
          * E.g. "Comptroller SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, {comptroller, newPendingAdmin}) => setPendingAdmin(world, from, comptroller, newPendingAdmin.val)
    ),
    new Command<{comptroller: Comptroller}>(`
        #### AcceptAdmin

        * "Comptroller AcceptAdmin" - Accepts admin for the Comptroller
          * E.g. "From Geoff (Comptroller AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, from, {comptroller}) => acceptAdmin(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, newPauseGuardian: AddressV}>(`
        #### SetPauseGuardian

        * "Comptroller SetPauseGuardian newPauseGuardian:<Address>" - Sets the PauseGuardian for the Comptroller
          * E.g. "Comptroller SetPauseGuardian Geoff"
      `,
      "SetPauseGuardian",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPauseGuardian", getAddressV)
      ],
      (world, from, {comptroller, newPauseGuardian}) => setPauseGuardian(world, from, comptroller, newPauseGuardian.val)
    ),

    new Command<{comptroller: Comptroller, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianPaused

        * "Comptroller SetGuardianPaused <Action> <Bool>" - Pauses or unpaused given sToken function
        * E.g. "Comptroller SetGuardianPaused "Transfer" True"
        `,
        "SetGuardianPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {comptroller, action, isPaused}) => setGuardianPaused(world, from, comptroller, action.val, isPaused.val)
    ),

    new Command<{comptroller: Comptroller, sToken: SToken, action: StringV, isPaused: BoolV}>(`
        #### SetGuardianMarketPaused

        * "Comptroller SetGuardianMarketPaused <SToken> <Action> <Bool>" - Pauses or unpaused given sToken function
        * E.g. "Comptroller SetGuardianMarketPaused sREP "Mint" True"
        `,
        "SetGuardianMarketPaused",
        [
          new Arg("comptroller", getComptroller, {implicit: true}),
          new Arg("sToken", getSTokenV),
          new Arg("action", getStringV),
          new Arg("isPaused", getBoolV)
        ],
        (world, from, {comptroller, sToken, action, isPaused}) => setGuardianMarketPaused(world, from, comptroller, sToken, action.val, isPaused.val)
    ),

    new Command<{comptroller: Comptroller, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "STokenScenario" and "ComptrollerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Comptroller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {comptroller, blocks}) => fastForward(world, from, comptroller, blocks)
    ),
    new View<{comptroller: Comptroller}>(`
        #### Liquidity

        * "Comptroller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => printLiquidity(world, comptroller)
    ),
    new View<{comptroller: Comptroller, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Comptroller contract
      `,
      "Decode",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {comptroller, input}) => decodeCall(world, comptroller, input.val)
    ),

    new Command<{comptroller: Comptroller, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * Comptroller Send functionSignature:<String> callArgs[] - Sends any transaction to comptroller
      * E.g: Comptroller Send "setSTRKAddress(address)" (Address STRK)
      `,
      "Send",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {comptroller, signature, callArgs}) => sendAny(world, from, comptroller, signature.val, rawValues(callArgs))
    ),
    new Command<{comptroller: Comptroller, sTokens: SToken[]}>(`
      #### AddStrikeMarkets

      * "Comptroller AddStrikeMarkets (<Address> ...)" - Makes a market STRK-enabled
      * E.g. "Comptroller AddStrikeMarkets (sZRX sBAT)
      `,
      "AddStrikeMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sTokens", getSTokenV, {mapped: true})
      ],
      (world, from, {comptroller, sTokens}) => addStrikeMarkets(world, from, comptroller, sTokens)
     ),
    new Command<{comptroller: Comptroller, sToken: SToken}>(`
      #### DropStrikeMarket

      * "Comptroller DropStrikeMarket <Address>" - Makes a market STRK
      * E.g. "Comptroller DropStrikeMarket sZRX
      `,
      "DropStrikeMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sToken", getSTokenV)
      ],
      (world, from, {comptroller, sToken}) => dropStrikeMarket(world, from, comptroller, sToken)
     ),

    new Command<{comptroller: Comptroller}>(`
      #### RefreshStrikeSpeeds

      * "Comptroller RefreshStrikeSpeeds" - Recalculates all the STRK market speeds
      * E.g. "Comptroller RefreshStrikeSpeeds
      `,
      "RefreshStrikeSpeeds",
      [
        new Arg("comptroller", getComptroller, {implicit: true})
      ],
      (world, from, {comptroller}) => refreshStrikeSpeeds(world, from, comptroller)
    ),

    new Command<{comptroller: Comptroller, sToken: SToken, speed: NumberV}>(`
      #### SetStrikeSpeed (deprecated)
      * "Comptroller SetStrikeSpeed <sToken> <rate> " - Sets STRK speed for market
      * E.g. "Comptroller SetStrikeSpeed sToken 10000
      `,
      "SetStrikeSpeed",
      [
        new Arg("comptroller", getComptroller, { implicit: true }),
        new Arg("sToken", getSTokenV),
        new Arg("speed", getNumberV)
      ],
      (world, from, { comptroller, sToken, speed }) => setStrikeSpeed(world, from, comptroller, sToken, speed)
    ),

    new Command<{comptroller: Comptroller, sTokens: SToken[], supplySpeeds: NumberV[], borrowSpeeds: NumberV[]}>(`
      #### SetStrikeSpeeds
      * "Comptroller SetStrikeSpeeds (<sToken> ...) (<supplySpeed> ...) (<borrowSpeed> ...)" - Sets STRK speeds for markets
      * E.g. "Comptroller SetStrikeSpeeds (sZRX sBAT) (1000 0) (1000 2000)
      `,
      "SetStrikeSpeeds",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("sTokens", getSTokenV, {mapped: true}),
        new Arg("supplySpeeds", getNumberV, {mapped: true}),
        new Arg("borrowSpeeds", getNumberV, {mapped: true})
      ],
      (world, from, {comptroller, sTokens, supplySpeeds, borrowSpeeds}) => setStrikeSpeeds(world, from, comptroller, sTokens, supplySpeeds, borrowSpeeds)
    ),
    
    new Command<{comptroller: Comptroller, holder: AddressV}>(`
      #### ClaimStrike

      * "Comptroller ClaimStrike <holder>" - Claims strk
      * E.g. "Comptroller ClaimStrike Geoff
      `,
      "ClaimStrike",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("holder", getAddressV)
      ],
      (world, from, {comptroller, holder}) => claimStrike(world, from, comptroller, holder.val)
    ),
    
    new Command<{comptroller: Comptroller, contributor: AddressV}>(`
      #### UpdateContributorRewards
      * "Comptroller UpdateContributorRewards <contributor>" - Updates rewards for a contributor
      * E.g. "Comptroller UpdateContributorRewards Geoff
      `,
      "UpdateContributorRewards",
      [
        new Arg("comptroller", getComptroller, { implicit: true }),
        new Arg("contributor", getAddressV)
      ],
      (world, from, { comptroller, contributor }) => updateContributorRewards(world, from, comptroller, contributor.val)
    ),

    new Command<{comptroller: Comptroller, recipient: AddressV, amount: NumberV}>(`
      #### GrantSTRK
      * "Comptroller GrantSTRK <recipient> <amount>" - Grant STRK to a recipient
      * E.g. "Comptroller GrantSTRK Geoff 1e18
      `,
      "GrantSTRK",
      [
        new Arg("comptroller", getComptroller, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { comptroller, recipient, amount }) => grantSTRK(world, from, comptroller, recipient.val, amount)
    ),

    new Command<{comptroller: Comptroller, contributor: AddressV, strikeSpeed: NumberV}>(`
      #### SetContributorStrikeSpeed
      * "Comptroller SetContributorStrikeSpeed <contributor> <strikeSpeed>" - Set Contributor Strike Speed
      * E.g. "Comptroller SetContributorStrikeSpeed Geoff 1e18
      `,
      "SetContributorStrikeSpeed",
      [
        new Arg("comptroller", getComptroller, { implicit: true }),
        new Arg("contributor", getAddressV),
        new Arg("strikeSpeed", getNumberV)
      ],
      (world, from, { comptroller, contributor, strikeSpeed }) => setContributorStrikeSpeed(world, from, comptroller, contributor.val, strikeSpeed)
    ),

    new Command<{comptroller: Comptroller, rate: NumberV}>(`
      #### SetStrikeRate

      * "Comptroller SetStrikeRate <rate>" - Sets STRK rate
      * E.g. "Comptroller SetStrikeRate 1e18
      `,
      "SetStrikeRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("rate", getNumberV)
      ],
      (world, from, {comptroller, rate}) => setStrikeRate(world, from, comptroller, rate)
    ),
  ];
}

export async function processComptrollerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Comptroller", comptrollerCommands(), world, event, from);
}
