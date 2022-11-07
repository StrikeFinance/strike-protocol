const {
  etherMantissa,
  both,
  minerStart,
  minerStop,
} = require('../Utils/Ethereum');

const {
  makeStaking,
  balanceOf,
  fastForward,
  preApprove
} = require('../Utils/Strike');

describe('Staking', () => {
  let root, accounts;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("on success it sets admin to creator and pendingAdmin is unset", async () => {
      const comptroller = await makeStaking();
      expect(await call(comptroller, 'admin')).toEqual(root);
      expect(await call(comptroller, 'pendingAdmin')).toEqualNumber(0);
    });
  });
});
