import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { STokenMethods, STokenScenarioMethods } from './SToken';

interface SErc20DelegateMethods extends STokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface SErc20DelegateScenarioMethods extends STokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface SErc20Delegate extends Contract {
  methods: SErc20DelegateMethods;
  name: string;
}

export interface SErc20DelegateScenario extends Contract {
  methods: SErc20DelegateScenarioMethods;
  name: string;
}
