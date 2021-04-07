import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface StrikeLensMethods {
  sTokenBalances(sToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  sTokenBalancesAll(sTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  sTokenMetadata(sToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  sTokenMetadataAll(sTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  sTokenUnderlyingPrice(sToken: string): Sendable<[string,number]>;
  sTokenUnderlyingPriceAll(sTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface StrikeLens extends Contract {
  methods: StrikeLensMethods;
  name: string;
}
