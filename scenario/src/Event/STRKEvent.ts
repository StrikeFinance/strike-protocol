import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { STRK, STRKScenario } from '../Contract/STRK';
import { buildStrike } from '../Builder/StrikeBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getSTRK } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genStrike(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, strk, tokenData } = await buildStrike(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed STRK (${strk.name}) to address ${strk._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyStrike(world: World, strk: STRK, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, strk._address);
  }

  return world;
}

async function approve(world: World, from: string, strk: STRK, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, strk.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved Strk token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, strk: STRK, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, strk.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} STRK tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, strk: STRK, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, strk.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} STRK tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, strk: STRKScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, strk.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} STRK tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, strk: STRKScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, strk.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} STRK tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, strk: STRK, account: string): Promise<World> {
  let invokation = await invoke(world, strk.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  strk: STRK,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set STRK blockNumber to ${blockNumber.show()}`,
    await invoke(world, strk.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function strkCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new Strk token
          * E.g. "STRK Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genStrike(world, from, params.val)
    ),

    new View<{ strk: STRK, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<STRK> Verify apiKey:<String> contractName:<String>=STRK" - Verifies Strk token in Etherscan
          * E.g. "STRK Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("STRK") })
      ],
      async (world, { strk, apiKey, contractName }) => {
        return await verifyStrike(world, strk, apiKey.val, strk.name, contractName.val)
      }
    ),

    new Command<{ strk: STRK, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "STRK Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "STRK Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { strk, spender, amount }) => {
        return approve(world, from, strk, spender.val, amount)
      }
    ),

    new Command<{ strk: STRK, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "STRK Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "STRK Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { strk, recipient, amount }) => transfer(world, from, strk, recipient.val, amount)
    ),

    new Command<{ strk: STRK, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "STRK TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "STRK TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { strk, owner, spender, amount }) => transferFrom(world, from, strk, owner.val, spender.val, amount)
    ),

    new Command<{ strk: STRKScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "STRK TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "STRK TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { strk, recipients, amount }) => transferScenario(world, from, strk, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ strk: STRKScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "STRK TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "STRK TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { strk, froms, amount }) => transferFromScenario(world, from, strk, froms.map(_from => _from.val), amount)
    ),

    new Command<{ strk: STRK, account: AddressV }>(`
        #### Delegate

        * "STRK Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "STRK Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { strk, account }) => delegate(world, from, strk, account.val)
    ),
    new Command<{ strk: STRK, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the STRK Harness
      * E.g. "STRK SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('strk', getSTRK, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { strk, blockNumber }) => setBlockNumber(world, from, strk, blockNumber)
      )
  ];
}

export async function processSTRKEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("STRK", strkCommands(), world, event, from);
}
