import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, sToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMintPaused(bool): Sendable<number>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setPauseGuardian(string): Sendable<number>
  pauseGuardian(): Callable<string>
  _setProtocolPaused(bool): Sendable<number>
  protocolPaused(): Callable<boolean>
  _setMintPaused(market: string, string): Sendable<number>
  _setBorrowPaused(market: string, string): Sendable<number>
  _setTransferPaused(string): Sendable<number>
  _setSeizePaused(string): Sendable<number>
  _mintGuardianPaused(): Callable<boolean>
  _borrowGuardianPaused(): Callable<boolean>
  transferGuardianPaused(): Callable<boolean>
  seizeGuardianPaused(): Callable<boolean>
  mintGuardianPaused(market: string): Callable<boolean>
  borrowGuardianPaused(market: string): Callable<boolean>
  _addStrikeMarkets(markets: string[]): Sendable<void>
  _dropStrikeMarket(market: string): Sendable<void>
  getStrikeMarkets(): Callable<string[]>
  refreshStrikeSpeeds(): Sendable<void>
  strikeRate(): Callable<number>
  strikeSupplyState(string): Callable<string>
  strikeBorrowState(string): Callable<string>
  strikeAccrued(string): Callable<string>
  strikeSupplierIndex(market: string, account: string): Callable<string>
  strikeBorrowerIndex(market: string, account: string): Callable<string>
  strikeSpeeds(string): Callable<string>
  strikeSupplySpeeds(string): Callable<string>
  strikeBorrowSpeeds(string): Callable<string>
  claimStrike(string): Sendable<void>
  updateContributorRewards(account: string): Sendable<void>
  _setContributorStrikeSpeed(account: string, encodedNumber): Sendable<void>
  _grantSTRK(account: string, encodedNumber): Sendable<void>
  _setStrikeRate(encodedNumber): Sendable<void>
  _setStrikeSpeed(sToken: string, encodedNumber): Sendable<void>
  _setStrikeSpeeds(cTokens: string[], supplySpeeds: encodedNumber[], borrowSpeeds: encodedNumber[]): Sendable<void>
  _setReserveInfo(guardian, address): Sendable<number>
  _setStrkStakingInfo(address): Sendable<number>
  _setMarketCaps(sTokens:string[], supplyCaps:encodedNumber[], borrowCaps:encodedNumber[]): Sendable<void>
  _setMarketCapGuardian(string): Sendable<void>
  marketCapGuardian(): Callable<string>
  supplyCaps(string): Callable<string>
  borrowCaps(string): Callable<string>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
