import { Event } from '../Event';
import { World } from '../World';
import { SErc20Delegate } from '../Contract/SErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getSTokenDelegateAddress } from '../ContractLookup';

export async function getSTokenDelegateV(world: World, event: Event): Promise<SErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SErc20Delegate>(world, address.val);
}

async function sTokenDelegateAddress(world: World, sTokenDelegate: SErc20Delegate): Promise<AddressV> {
  return new AddressV(sTokenDelegate._address);
}

export function sTokenDelegateFetchers() {
  return [
    new Fetcher<{ sTokenDelegate: SErc20Delegate }, AddressV>(`
        #### Address

        * "STokenDelegate <STokenDelegate> Address" - Returns address of STokenDelegate contract
          * E.g. "STokenDelegate sDaiDelegate Address" - Returns sDaiDelegate's address
      `,
      "Address",
      [
        new Arg("sTokenDelegate", getSTokenDelegateV)
      ],
      (world, { sTokenDelegate }) => sTokenDelegateAddress(world, sTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getSTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("STokenDelegate", sTokenDelegateFetchers(), world, event);
}
