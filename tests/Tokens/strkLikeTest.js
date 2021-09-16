const {
  makeSToken
} = require('../Utils/Strike');

describe('SStrkLikeDelegate', function() {
  describe("_delegateStrkLikeTo", () => {
    it ("does not delegate if not admin", async() => {
      const [root, a1] = saddle.accounts;
      const sToken = await makeSToken({ kind: 'sstrk' });
      await expect(send(sToken, '_delegateStrkLikeTo', [a1], { from: a1 })).rejects.toRevert('revert only the admin may set the strk-like delegate');
    });

    it ("delegates successfully if admin", async() => {
      const [root, a1] = saddle.accounts, amount = 10;
      const sSTRK = await makeSToken({ kind: 'sstrk' }), STRK = sSTRK.underlying;
      const tx1 = await send(sSTRK, '_delegateStrkLikeTo', [a1]);
      const tx2 = await send(STRK, 'transfer', [sSTRK._address, amount]);
      await expect(await call(STRK, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});