import { Event } from '../Event';
import { World, addAction } from '../World';
import { STRK, STRKScenario } from '../Contract/STRK';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const STRKContract = getContract('STRK');
const STRKScenarioContract = getContract('STRKScenario');

export interface TokenData {
  invokation: Invokation<STRK>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildStrike(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; strk: STRK; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "STRK Deploy Scenario account:<Address>" - Deploys Scenario STRK Token
        * E.g. "STRK Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await STRKScenarioContract.deploy<STRKScenario>(world, from, [account.val]),
          contract: 'STRKScenario',
          symbol: 'STRK',
          name: 'Strike Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### STRK

      * "STRK Deploy account:<Address>" - Deploys STRK Token
        * E.g. "STRK Deploy Geoff"
    `,
      'STRK',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await STRKScenarioContract.deploy<STRKScenario>(world, from, [account.val]),
            contract: 'STRKScenario',
            symbol: 'STRK',
            name: 'Strike Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await STRKContract.deploy<STRK>(world, from, [account.val]),
            contract: 'STRK',
            symbol: 'STRK',
            name: 'Strike Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployComp", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const strk = invokation.value!;
  tokenData.address = strk._address;

  world = await storeAndSaveContract(
    world,
    strk,
    'STRK',
    invokation,
    [
      { index: ['STRK'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, strk, tokenData };
}
