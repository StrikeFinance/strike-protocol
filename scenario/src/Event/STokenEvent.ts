import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { SToken, STokenScenario } from '../Contract/SToken';
import { SErc20Delegate } from '../Contract/SErc20Delegate'
import { SErc20Delegator } from '../Contract/SErc20Delegator'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { STokenErrorReporter } from '../ErrorReporter';
import { getComptroller, getSTokenData } from '../ContractLookup';
import { getExpMantissa } from '../Encoding';
import { buildSToken } from '../Builder/STokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getSTokenV, getSErc20DelegatorV } from '../Value/STokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genSToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, sToken, tokenData } = await buildSToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added sToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${sToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, sToken: SToken): Promise<World> {
  let invokation = await invoke(world, sToken.methods.accrueInterest(), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, sToken: SToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, sToken.methods.mint(amount.encode()), from, STokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, sToken.methods.mint(), from, STokenErrorReporter);
  }

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, sToken: SToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods.redeem(tokens.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, sToken: SToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods.redeemUnderlying(amount.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, sToken: SToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods.borrow(amount.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, sToken: SToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, sToken.methods.repayBorrow(amount.encode()), from, STokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, sToken.methods.repayBorrow(), from, STokenErrorReporter);
  }

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, sToken: SToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, sToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, STokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, sToken.methods.repayBorrowBehalf(behalf), from, STokenErrorReporter);
  }

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, sToken: SToken, borrower: string, collateral: SToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, sToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, STokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, sToken.methods.liquidateBorrow(borrower, collateral._address), from, STokenErrorReporter);
  }

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, sToken: SToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, sToken: SToken, treasure: SToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, sToken: SToken, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, sToken.methods._setPendingAdmin(newPendingAdmin), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, sToken: SToken): Promise<World> {
  let invokation = await invoke(world, sToken.methods._acceptAdmin(), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, sToken: SToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods._addReserves(amount.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, sToken: SToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods._reduceReserves(amount.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function transferReserves(world: World, from: string, sToken: SToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods._transferReserves(amount.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, sToken: SToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, sToken.methods._setReserveFactor(reserveFactor.encode()), from, STokenErrorReporter);

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, sToken: SToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, sToken.methods._setInterestRateModel(interestRateModel), from, STokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${sToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, sToken: SToken, comptroller: string): Promise<World> {
  let invokation = await invoke(world, sToken.methods._setComptroller(comptroller), from, STokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${sToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  sToken: SToken,
  becomeImplementationData: string
): Promise<World> {

  const sErc20Delegate = getContract('SErc20Delegate');
  const sErc20DelegateContract = await sErc20Delegate.at<SErc20Delegate>(world, sToken._address);

  let invokation = await invoke(
    world,
    sErc20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    STokenErrorReporter
  );

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  sToken: SToken,
): Promise<World> {

  const sErc20Delegate = getContract('SErc20Delegate');
  const sErc20DelegateContract = await sErc20Delegate.at<SErc20Delegate>(world, sToken._address);

  let invokation = await invoke(
    world,
    sErc20DelegateContract.methods._resignImplementation(),
    from,
    STokenErrorReporter
  );

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  sToken: SErc20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    sToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    STokenErrorReporter
  );

  world = addAction(
    world,
    `SToken ${sToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, sToken: SToken): Promise<World> {
  let invokation = await invoke(world, sToken.methods.donate(), from, STokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${sToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function setSTokenMock(world: World, from: string, sToken: STokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = sToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = sToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for sToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${sToken.name}`,
    invokation
  );

  return world;
}

async function verifySToken(world: World, sToken: SToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, sToken._address);
  }

  return world;
}

async function printMinters(world: World, sToken: SToken): Promise<World> {
  let events = await getPastEvents(world, sToken, sToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, sToken: SToken): Promise<World> {
  let events = await getPastEvents(world, sToken, sToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, sToken: SToken): Promise<World> {
  let mintEvents = await getPastEvents(world, sToken, sToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, sToken, sToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let comptroller = await getComptroller(world);

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

export function sTokenCommands() {
  return [
    new Command<{ sTokenParams: EventV }>(`
        #### Deploy

        * "SToken Deploy ...sTokenParams" - Generates a new SToken
          * E.g. "SToken sZRX Deploy"
      `,
      "Deploy",
      [new Arg("sTokenParams", getEventV, { variadic: true })],
      (world, from, { sTokenParams }) => genSToken(world, from, sTokenParams.val)
    ),
    new View<{ sTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "SToken <sToken> Verify apiKey:<String>" - Verifies SToken in Etherscan
          * E.g. "SToken sZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("sTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { sTokenArg, apiKey }) => {
        let [sToken, name, data] = await getSTokenData(world, sTokenArg.val);

        return await verifySToken(world, sToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken }>(`
        #### AccrueInterest

        * "SToken <sToken> AccrueInterest" - Accrues interest for given token
          * E.g. "SToken sZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, from, { sToken }) => accrueInterest(world, from, sToken),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "SToken <sToken> Mint amount:<Number>" - Mints the given amount of sToken as specified user
          * E.g. "SToken sZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { sToken, amount }) => mint(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, tokens: NumberV }>(`
        #### Redeem

        * "SToken <sToken> Redeem tokens:<Number>" - Redeems the given amount of sTokens as specified user
          * E.g. "SToken sZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("sToken", getSTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { sToken, tokens }) => redeem(world, from, sToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "SToken <sToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "SToken sZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sToken, amount }) => redeemUnderlying(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV }>(`
        #### Borrow

        * "SToken <sToken> Borrow amount:<Number>" - Borrows the given amount of this sToken as specified user
          * E.g. "SToken sZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { sToken, amount }) => borrow(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "SToken <sToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "SToken sZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { sToken, amount }) => repayBorrow(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "SToken <sToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "SToken sZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("sToken", getSTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { sToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, sToken: SToken, collateral: SToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "SToken <sToken> Liquidate borrower:<User> sTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "SToken sZRX Liquidate Geoff sBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("sToken", getSTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getSTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, sToken, collateral, repayAmount }) => liquidateBorrow(world, from, sToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "SToken <sToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other SToken)
          * E.g. "SToken sZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("sToken", getSTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { sToken, liquidator, borrower, seizeTokens }) => seize(world, from, sToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, treasure: SToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "SToken <sToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "SToken sEVL EvilSeize sZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("sToken", getSTokenV),
        new Arg("treasure", getSTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { sToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, sToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV }>(`
        #### ReduceReserves

        * "SToken <sToken> ReduceReserves amount:<Number>" - Reduces the reserves of the sToken
          * E.g. "SToken sZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sToken, amount }) => reduceReserves(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV }>(`
        #### TransferReserves

        * "SToken <sToken> TransferReserves amount:<Number>" - Transfer the reserves of the sToken
          * E.g. "SToken sZRX TransferReserves 1.0e18"
      `,
      "TransferReserves",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sToken, amount }) => transferReserves(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, amount: NumberV }>(`
    #### AddReserves

    * "SToken <sToken> AddReserves amount:<Number>" - Adds reserves to the sToken
      * E.g. "SToken sZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("sToken", getSTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sToken, amount }) => addReserves(world, from, sToken, amount),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, newPendingAdmin: AddressV }>(`
        #### SetPendingAdmin

        * "SToken <sToken> SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the sToken
          * E.g. "SToken sZRX SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("sToken", getSTokenV),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, { sToken, newPendingAdmin }) => setPendingAdmin(world, from, sToken, newPendingAdmin.val),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken }>(`
        #### AcceptAdmin

        * "SToken <sToken> AcceptAdmin" - Accepts admin for the sToken
          * E.g. "From Geoff (SToken sZRX AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, from, { sToken }) => acceptAdmin(world, from, sToken),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "SToken <sToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the sToken
          * E.g. "SToken sZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("sToken", getSTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { sToken, reserveFactor }) => setReserveFactor(world, from, sToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "SToken <sToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given sToken
          * E.g. "SToken sZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("sToken", getSTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { sToken, interestRateModel }) => setInterestRateModel(world, from, sToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, comptroller: AddressV }>(`
        #### SetComptroller

        * "SToken <sToken> SetComptroller comptroller:<Contract>" - Sets the comptroller for the given sToken
          * E.g. "SToken sZRX SetComptroller Comptroller"
      `,
      "SetComptroller",
      [
        new Arg("sToken", getSTokenV),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, { sToken, comptroller }) => setComptroller(world, from, sToken, comptroller.val),
      { namePos: 1 }
    ),
    new Command<{
      sToken: SToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "SToken <sToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "SToken sDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('sToken', getSTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { sToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          sToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{sToken: SToken;}>(
      `
        #### ResignImplementation

        * "SToken <sToken> ResignImplementation"
          * E.g. "SToken sDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('sToken', getSTokenV)],
      (world, from, { sToken }) =>
        resignImplementation(
          world,
          from,
          sToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      sToken: SErc20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "SToken <sToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "SToken sDAI SetImplementation (SToken sDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('sToken', getSErc20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { sToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          sToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken }>(`
        #### Donate

        * "SToken <sToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (SToken sETH Donate))"
      `,
      "Donate",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, from, { sToken }) => donate(world, from, sToken),
      { namePos: 1 }
    ),
    new Command<{ sToken: SToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "SToken <sToken> Mock variable:<String> value:<Number>" - Mocks a given value on sToken. Note: value must be a supported mock and this will only work on a "STokenScenario" contract.
          * E.g. "SToken sZRX Mock totalBorrows 5.0e18"
          * E.g. "SToken sZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("sToken", getSTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { sToken, variable, value }) => setSTokenMock(world, from, <STokenScenario>sToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ sToken: SToken }>(`
        #### Minters

        * "SToken <sToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => printMinters(world, sToken),
      { namePos: 1 }
    ),
    new View<{ sToken: SToken }>(`
        #### Borrowers

        * "SToken <sToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => printBorrowers(world, sToken),
      { namePos: 1 }
    ),
    new View<{ sToken: SToken }>(`
        #### Liquidity

        * "SToken <sToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => printLiquidity(world, sToken),
      { namePos: 1 }
    ),
    new View<{ sToken: SToken, input: StringV }>(`
        #### Decode

        * "Decode <sToken> input:<String>" - Prints information about a call to a sToken contract
      `,
      "Decode",
      [
        new Arg("sToken", getSTokenV),
        new Arg("input", getStringV)

      ],
      (world, { sToken, input }) => decodeCall(world, sToken, input.val),
      { namePos: 1 }
    )
  ];
}

export async function processSTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("SToken", sTokenCommands(), world, event, from);
}
