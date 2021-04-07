import { Event } from '../Event';
import { World } from '../World';
import { STRK } from '../Contract/STRK';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getSTRK } from '../ContractLookup';

export function strkFetchers() {
  return [
    new Fetcher<{ strk: STRK }, AddressV>(`
        #### Address

        * "<STRK> Address" - Returns the address of Strk token
          * E.g. "STRK Address"
      `,
      "Address",
      [
        new Arg("strk", getSTRK, { implicit: true })
      ],
      async (world, { strk }) => new AddressV(strk._address)
    ),

    new Fetcher<{ strk: STRK }, StringV>(`
        #### Name

        * "<STRK> Name" - Returns the name of the Strk token
          * E.g. "STRK Name"
      `,
      "Name",
      [
        new Arg("strk", getSTRK, { implicit: true })
      ],
      async (world, { strk }) => new StringV(await strk.methods.name().call())
    ),

    new Fetcher<{ strk: STRK }, StringV>(`
        #### Symbol

        * "<STRK> Symbol" - Returns the symbol of the Strk token
          * E.g. "STRK Symbol"
      `,
      "Symbol",
      [
        new Arg("strk", getSTRK, { implicit: true })
      ],
      async (world, { strk }) => new StringV(await strk.methods.symbol().call())
    ),

    new Fetcher<{ strk: STRK }, NumberV>(`
        #### Decimals

        * "<STRK> Decimals" - Returns the number of decimals of the Strk token
          * E.g. "STRK Decimals"
      `,
      "Decimals",
      [
        new Arg("strk", getSTRK, { implicit: true })
      ],
      async (world, { strk }) => new NumberV(await strk.methods.decimals().call())
    ),

    new Fetcher<{ strk: STRK }, NumberV>(`
        #### TotalSupply

        * "STRK TotalSupply" - Returns Strk token's total supply
      `,
      "TotalSupply",
      [
        new Arg("strk", getSTRK, { implicit: true })
      ],
      async (world, { strk }) => new NumberV(await strk.methods.totalSupply().call())
    ),

    new Fetcher<{ strk: STRK, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "STRK TokenBalance <Address>" - Returns the Strk token balance of a given address
          * E.g. "STRK TokenBalance Geoff" - Returns Geoff's STRK balance
      `,
      "TokenBalance",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { strk, address }) => new NumberV(await strk.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ strk: STRK, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "STRK Allowance owner:<Address> spender:<Address>" - Returns the STRK allowance from owner to spender
          * E.g. "STRK Allowance Geoff Torrey" - Returns the STRK allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { strk, owner, spender }) => new NumberV(await strk.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ strk: STRK, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "STRK GetCurrentVotes account:<Address>" - Returns the current STRK votes balance for an account
          * E.g. "STRK GetCurrentVotes Geoff" - Returns the current STRK vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { strk, account }) => new NumberV(await strk.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ strk: STRK, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "STRK GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current STRK votes balance at given block
          * E.g. "STRK GetPriorVotes Geoff 5" - Returns the STRK vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { strk, account, blockNumber }) => new NumberV(await strk.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ strk: STRK, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "STRK GetCurrentVotesBlock account:<Address>" - Returns the current STRK votes checkpoint block for an account
          * E.g. "STRK GetCurrentVotesBlock Geoff" - Returns the current STRK votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { strk, account }) => {
        const numCheckpoints = Number(await strk.methods.numCheckpoints(account.val).call());
        const checkpoint = await strk.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ strk: STRK, account: AddressV }, NumberV>(`
        #### VotesLength

        * "STRK VotesLength account:<Address>" - Returns the STRK vote checkpoint array length
          * E.g. "STRK VotesLength Geoff" - Returns the STRK vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { strk, account }) => new NumberV(await strk.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ strk: STRK, account: AddressV }, ListV>(`
        #### AllVotes

        * "STRK AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "STRK AllVotes Geoff" - Returns the STRK vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("strk", getSTRK, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { strk, account }) => {
        const numCheckpoints = Number(await strk.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await strk.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getStrkValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("STRK", strkFetchers(), world, event);
}
