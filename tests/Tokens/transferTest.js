const {makeSToken} = require('../Utils/Strike');

describe('SToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const sToken = await makeSToken({supportMarket: true});
      expect(await call(sToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(sToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const sToken = await makeSToken({supportMarket: true});
      await send(sToken, 'harnessSetBalance', [root, 100]);
      expect(await call(sToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(sToken, 'transfer', [accounts[0], 50]);
      expect(await call(sToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(sToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const sToken = await makeSToken({supportMarket: true});
      await send(sToken, 'harnessSetBalance', [root, 100]);
      expect(await call(sToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(sToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const sToken = await makeSToken({comptrollerOpts: {kind: 'bool'}});
      await send(sToken, 'harnessSetBalance', [root, 100]);
      expect(await call(sToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(sToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(sToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(sToken.comptroller, 'setTransferAllowed', [true])
      await send(sToken.comptroller, 'setTransferVerify', [false])
      await expect(send(sToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});