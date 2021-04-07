const {
  address,
  encodeParameters,
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeSToken,
} = require('../Utils/Strike');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('StrikeLens', () => {
  let strikeLens;
  let acct;

  beforeEach(async () => {
    strikeLens = await deploy('StrikeLens');
    acct = accounts[0];
  });

  describe('sTokenMetadata', () => {
    it('is correct for a sErc20', async () => {
      let sErc20 = await makeSToken();
      expect(
        cullTuple(await call(strikeLens, 'sTokenMetadata', [sErc20._address]))
      ).toEqual(
        {
          sToken: sErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(sErc20, 'underlying', []),
          sTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for sEth', async () => {
      let sEth = await makeSToken({kind: 'sether'});
      expect(
        cullTuple(await call(strikeLens, 'sTokenMetadata', [sEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        sToken: sEth._address,
        sTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('sTokenMetadataAll', () => {
    it('is correct for a sErc20 and sEther', async () => {
      let sErc20 = await makeSToken();
      let sEth = await makeSToken({kind: 'sether'});
      expect(
        (await call(strikeLens, 'sTokenMetadataAll', [[sErc20._address, sEth._address]])).map(cullTuple)
      ).toEqual([
        {
          sToken: sErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(sErc20, 'underlying', []),
          sTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          sToken: sEth._address,
          sTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('sTokenBalances', () => {
    it('is correct for sERC20', async () => {
      let sErc20 = await makeSToken();
      expect(
        cullTuple(await call(strikeLens, 'sTokenBalances', [sErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          sToken: sErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for sETH', async () => {
      let sEth = await makeSToken({kind: 'sether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(strikeLens, 'sTokenBalances', [sEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          sToken: sEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('sTokenBalancesAll', () => {
    it('is correct for sEth and sErc20', async () => {
      let sErc20 = await makeSToken();
      let sEth = await makeSToken({kind: 'sether'});
      let ethBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(strikeLens, 'sTokenBalancesAll', [[sErc20._address, sEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          sToken: sErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          sToken: sEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('sTokenUnderlyingPrice', () => {
    it('gets correct price for sErc20', async () => {
      let sErc20 = await makeSToken();
      expect(
        cullTuple(await call(strikeLens, 'sTokenUnderlyingPrice', [sErc20._address]))
      ).toEqual(
        {
          sToken: sErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for sEth', async () => {
      let sEth = await makeSToken({kind: 'sether'});
      expect(
        cullTuple(await call(strikeLens, 'sTokenUnderlyingPrice', [sEth._address]))
      ).toEqual(
        {
          sToken: sEth._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('sTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let sErc20 = await makeSToken();
      let sEth = await makeSToken({kind: 'sether'});
      expect(
        (await call(strikeLens, 'sTokenUnderlyingPriceAll', [[sErc20._address, sEth._address]])).map(cullTuple)
      ).toEqual([
        {
          sToken: sErc20._address,
          underlyingPrice: "0",
        },
        {
          sToken: sEth._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(strikeLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let strk, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;

    beforeEach(async () => {
      strk = await deploy('STRK', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), strk._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(strk, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(strikeLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(strikeLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + 17281).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + 1).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('strk', () => {
    let strk, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      strk = await deploy('STRK', [acct]);
    });

    describe('getStrikeBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(strikeLens, 'getStrikeBalanceMetadata', [strk._address, acct]))
        ).toEqual({
          balance: "6518828000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getStrikeBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setStrikeAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(strikeLens, 'getStrikeBalanceMetadataExt', [strk._address, comptroller._address, acct]))
        ).toEqual({
          balance: "6518828000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getStrikeVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(strikeLens, 'getStrikeVotes', [strk._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(strikeLens, 'getStrikeVotes', [strk._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert Strk::getPriorVotes: not yet determined')
      });
    });
  });
});
