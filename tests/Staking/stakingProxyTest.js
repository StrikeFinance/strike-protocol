const {
  address,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeStaking,
  makePriceOracle
} = require('../Utils/Strike');

describe('StakingProxy', () => {
  let root, accounts;
  let stakingProxy;
  let brains;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    brains = await deploy('StrikeStaking');
    stakingProxy = await deploy('StrikeStakingProxy');
  });

  let setPending = (implementation, from) => {
    return send(stakingProxy, '_setPendingImplementation', [implementation._address], {from});
  };

  describe("constructor", () => {
    it("sets admin to caller and addresses to 0", async () => {
      expect(await call(stakingProxy, 'admin')).toEqual(root);
      expect(await call(stakingProxy, 'pendingAdmin')).toBeAddressZero();
      expect(await call(stakingProxy, 'pendingStrikeStakingImplementation')).toBeAddressZero();
      expect(await call(stakingProxy, 'strikeStakingImplementation')).toBeAddressZero();
    });
  });

  describe("_setPendingImplementation", () => {
    describe("Check caller is admin", () => {
      let result;
      beforeEach(async () => {
        result = setPending(brains, accounts[1]);
      });

      it("emits a failure log", async () => {
        await expect(result).rejects.toRevert('revert SET_PENDING_IMPLEMENTATION_OWNER_CHECK');
      });

      it("does not change pending implementation address", async () => {
        await expect(result).rejects.toRevert('revert SET_PENDING_IMPLEMENTATION_OWNER_CHECK');
        expect(await call(stakingProxy, 'pendingStrikeStakingImplementation')).toBeAddressZero()
      });
    });

    describe("succeeding", () => {
      it("stores pendingStrikeStakingImplementation with value newPendingImplementation", async () => {
        await setPending(brains, root);
        expect(await call(stakingProxy, 'pendingStrikeStakingImplementation')).toEqual(brains._address);
      });

      it("emits NewPendingImplementation event", async () => {
        expect(await send(stakingProxy, '_setPendingImplementation', [brains._address])).toHaveLog('NewPendingImplementation', {
            oldPendingImplementation: address(0),
            newPendingImplementation: brains._address
          });
      });
    });
  });

  describe("_acceptImplementation", () => {
    describe("Check caller is pendingStrikeStakingImplementation  and pendingStrikeStakingImplementation ≠ address(0) ", () => {
      let result;
      beforeEach(async () => {
        await setPending(stakingProxy, root);
        result = send(stakingProxy, '_acceptImplementation');
      });

      it("emits a failure log", async () => {
        await expect(result).rejects.toRevert('revert ACCEPT_PENDING_IMPLEMENTATION_ADDRESS_CHECK');
      });

      it("does not change current implementation address", async () => {
        await expect(result).rejects.toRevert('revert ACCEPT_PENDING_IMPLEMENTATION_ADDRESS_CHECK');
        expect(await call(stakingProxy, 'strikeStakingImplementation')).not.toEqual(stakingProxy._address);
      });
    });

    it.skip("rejects if pending impl is address(0)", async () => {
      // XXX TODO?
    });

    describe("the brains must accept the responsibility of implementation", () => {
      let result;
      beforeEach(async () => {
        await setPending(brains, root);
        result = await send(brains, '_become', [stakingProxy._address]);
        expect(result).toSucceed();
      });

      it("Store strikeStakingImplementation with value pendingStrikeStakingImplementation", async () => {
        expect(await call(stakingProxy, 'strikeStakingImplementation')).toEqual(brains._address);
      });

      it("Unset pendingStrikeStakingImplementation", async () => {
        expect(await call(stakingProxy, 'pendingStrikeStakingImplementation')).toBeAddressZero();
      });

      it.skip("Emit NewImplementation(oldImplementation, newImplementation)", async () => {
        // TODO:
        // Does our log decoder expect it to come from the same contract?
        // assert.toHaveLog(
        //   result,
        //   "NewImplementation",
        //   {
        //     newImplementation: brains._address,
        //     oldImplementation: "0x0000000000000000000000000000000000000000"
        //   });
      });

      it.skip("Emit NewPendingImplementation(oldPendingImplementation, 0)", async () => {
        // TODO:
        // Does our log decoder expect it to come from the same contract?
        // Having difficulty decoding these events
        // assert.toHaveLog(
        //   result,
        //   "NewPendingImplementation",
        //   {
        //     oldPendingImplementation: brains._address,
        //     newPendingImplementation: "0x0000000000000000000000000000000000000000"
        //   });
      });
    });
  });
});
