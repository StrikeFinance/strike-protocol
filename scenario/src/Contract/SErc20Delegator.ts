import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { STokenMethods } from './SToken';
import { encodedNumber } from '../Encoding';

interface SErc20DelegatorMethods extends STokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface SErc20DelegatorScenarioMethods extends SErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface SErc20Delegator extends Contract {
  methods: SErc20DelegatorMethods;
  name: string;
}

export interface SErc20DelegatorScenario extends Contract {
  methods: SErc20DelegatorMethods;
  name: string;
}
