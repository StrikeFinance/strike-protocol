import { Event } from '../Event';
import { World } from '../World';
import { SErc20Delegate, SErc20DelegateScenario } from '../Contract/SErc20Delegate';
import { SToken } from '../Contract/SToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const SDaiDelegateContract = getContract('SDaiDelegate');
const SDaiDelegateScenarioContract = getTestContract('SDaiDelegateScenario');
const SErc20DelegateContract = getContract('SErc20Delegate');
const SErc20DelegateScenarioContract = getTestContract('SErc20DelegateScenario');


export interface STokenDelegateData {
  invokation: Invokation<SErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildSTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; sTokenDelegate: SErc20Delegate; delegateData: STokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, STokenDelegateData>(
      `
        #### SDaiDelegate

        * "SDaiDelegate name:<String>"
          * E.g. "STokenDelegate Deploy SDaiDelegate sDAIDelegate"
      `,
      'SDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SDaiDelegateContract.deploy<SErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'SDaiDelegate',
          description: 'Standard SDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, STokenDelegateData>(
      `
        #### SDaiDelegateScenario

        * "SDaiDelegateScenario name:<String>" - A SDaiDelegate Scenario for local testing
          * E.g. "STokenDelegate Deploy SDaiDelegateScenario sDAIDelegate"
      `,
      'SDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SDaiDelegateScenarioContract.deploy<SErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'SDaiDelegateScenario',
          description: 'Scenario SDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, STokenDelegateData>(
      `
        #### SErc20Delegate

        * "SErc20Delegate name:<String>"
          * E.g. "STokenDelegate Deploy SErc20Delegate sDAIDelegate"
      `,
      'SErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SErc20DelegateContract.deploy<SErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'SErc20Delegate',
          description: 'Standard SErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, STokenDelegateData>(
      `
        #### SErc20DelegateScenario

        * "SErc20DelegateScenario name:<String>" - A SErc20Delegate Scenario for local testing
          * E.g. "STokenDelegate Deploy SErc20DelegateScenario sDAIDelegate"
      `,
      'SErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SErc20DelegateScenarioContract.deploy<SErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'SErc20DelegateScenario',
          description: 'Scenario SErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, STokenDelegateData>("DeploySToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const sTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    sTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['STokenDelegate', delegateData.name],
        data: {
          address: sTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, sTokenDelegate, delegateData };
}
