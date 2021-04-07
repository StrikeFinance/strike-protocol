import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { SToken, STokenScenario } from '../Contract/SToken';
import { SErc20Delegate } from '../Contract/SErc20Delegate'
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
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getSTokenDelegateData } from '../ContractLookup';
import { buildSTokenDelegate } from '../Builder/STokenDelegateBuilder';
import { verify } from '../Verify';

async function genSTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, sTokenDelegate, delegateData } = await buildSTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added sToken ${delegateData.name} (${delegateData.contract}) at address ${sTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifySTokenDelegate(world: World, sTokenDelegate: SErc20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, sTokenDelegate._address);
  }

  return world;
}

export function sTokenDelegateCommands() {
  return [
    new Command<{ sTokenDelegateParams: EventV }>(`
        #### Deploy

        * "STokenDelegate Deploy ...sTokenDelegateParams" - Generates a new STokenDelegate
          * E.g. "STokenDelegate Deploy SDaiDelegate sDAIDelegate"
      `,
      "Deploy",
      [new Arg("sTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { sTokenDelegateParams }) => genSTokenDelegate(world, from, sTokenDelegateParams.val)
    ),
    new View<{ sTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "STokenDelegate <sTokenDelegate> Verify apiKey:<String>" - Verifies STokenDelegate in Etherscan
          * E.g. "STokenDelegate sDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("sTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { sTokenDelegateArg, apiKey }) => {
        let [sToken, name, data] = await getSTokenDelegateData(world, sTokenDelegateArg.val);

        return await verifySTokenDelegate(world, sToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processSTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("STokenDelegate", sTokenDelegateCommands(), world, event, from);
}
