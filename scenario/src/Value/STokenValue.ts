import { Event } from '../Event';
import { World } from '../World';
import { SToken } from '../Contract/SToken';
import { SErc20Delegator } from '../Contract/SErc20Delegator';
import { Erc20 } from '../Contract/Erc20';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';
import { getWorldContractByAddress, getSTokenAddress } from '../ContractLookup';

export async function getSTokenV(world: World, event: Event): Promise<SToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SToken>(world, address.val);
}

export async function getSErc20DelegatorV(world: World, event: Event): Promise<SErc20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SErc20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(await sToken.methods.interestRateModel().call());
}

async function sTokenAddress(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(sToken._address);
}

async function getSTokenAdmin(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(await sToken.methods.admin().call());
}

async function getSTokenPendingAdmin(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(await sToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, sToken: SToken, user: string): Promise<NumberV> {
  return new NumberV(await sToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, sToken: SToken, user): Promise<NumberV> {
  return new NumberV(await sToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, sToken: SToken, user): Promise<NumberV> {
  return new NumberV(await sToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.totalReserves().call());
}

async function getComptroller(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(await sToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.getCash().call());
}

async function getInterestRate(world: World, sToken: SToken): Promise<NumberV> {
  return new NumberV(await sToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, sToken: SToken): Promise<AddressV> {
  return new AddressV(await (sToken as SErc20Delegator).methods.implementation().call());
}

export function sTokenFetchers() {
  return [
    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### Address

        * "SToken <SToken> Address" - Returns address of SToken contract
          * E.g. "SToken sZRX Address" - Returns sZRX's address
      `,
      "Address",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => sTokenAddress(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### InterestRateModel

        * "SToken <SToken> InterestRateModel" - Returns the interest rate model of SToken contract
          * E.g. "SToken sZRX InterestRateModel" - Returns sZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getInterestRateModel(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### Admin

        * "SToken <SToken> Admin" - Returns the admin of SToken contract
          * E.g. "SToken sZRX Admin" - Returns sZRX's admin
      `,
      "Admin",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getSTokenAdmin(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### PendingAdmin

        * "SToken <SToken> PendingAdmin" - Returns the pending admin of SToken contract
          * E.g. "SToken sZRX PendingAdmin" - Returns sZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getSTokenPendingAdmin(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### Underlying

        * "SToken <SToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "SToken sZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("sToken", getSTokenV)
      ],
      async (world, { sToken }) => new AddressV(await sToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "SToken <SToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "SToken sZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("sToken", getSTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { sToken, address }) => balanceOfUnderlying(world, sToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "SToken <SToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "SToken sZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("sToken", getSTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { sToken, address }) => getBorrowBalance(world, sToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "SToken <SToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "SToken sZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("sToken", getSTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { sToken, address }) => getBorrowBalanceStored(world, sToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### TotalBorrows

        * "SToken <SToken> TotalBorrows" - Returns the sToken's total borrow balance
          * E.g. "SToken sZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getTotalBorrows(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "SToken <SToken> TotalBorrowsCurrent" - Returns the sToken's total borrow balance with interest
          * E.g. "SToken sZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getTotalBorrowsCurrent(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### Reserves

        * "SToken <SToken> Reserves" - Returns the sToken's total reserves
          * E.g. "SToken sZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getTotalReserves(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### ReserveFactor

        * "SToken <SToken> ReserveFactor" - Returns reserve factor of SToken contract
          * E.g. "SToken sZRX ReserveFactor" - Returns sZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getReserveFactor(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### Comptroller

        * "SToken <SToken> Comptroller" - Returns the sToken's comptroller
          * E.g. "SToken sZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getComptroller(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### ExchangeRateStored

        * "SToken <SToken> ExchangeRateStored" - Returns the sToken's exchange rate (based on balances stored)
          * E.g. "SToken sZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getExchangeRateStored(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### ExchangeRate

        * "SToken <SToken> ExchangeRate" - Returns the sToken's current exchange rate
          * E.g. "SToken sZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getExchangeRate(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### Cash

        * "SToken <SToken> Cash" - Returns the sToken's current cash
          * E.g. "SToken sZRX Cash"
      `,
      "Cash",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getCash(world, sToken),
      { namePos: 1 }
    ),

    new Fetcher<{ sToken: SToken }, NumberV>(`
        #### InterestRate

        * "SToken <SToken> InterestRate" - Returns the sToken's current interest rate
          * E.g. "SToken sZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, {sToken}) => getInterestRate(world, sToken),
      {namePos: 1}
    ),
    new Fetcher<{sToken: SToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "SToken <SToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "SToken sZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("sToken", getSTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {sToken, signature}) => {
        const res = await world.web3.eth.call({
            to: sToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ sToken: SToken }, AddressV>(`
        #### Implementation

        * "SToken <SToken> Implementation" - Returns the sToken's current implementation
          * E.g. "SToken sDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("sToken", getSTokenV)
      ],
      (world, { sToken }) => getImplementation(world, sToken),
      { namePos: 1 }
    )
  ];
}

export async function getSTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("sToken", sTokenFetchers(), world, event);
}
