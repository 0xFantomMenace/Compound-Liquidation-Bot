// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

import "./external/CometInterface.sol";
import "./external/Ownable.sol";
import "./external/IERC20.sol";
import "./external/IUniswapV3Pool.sol";
import "./external/PoolAddress.sol";
import "./external/TransferHelper.sol";
import "./external/ISwapRouter.sol";
import "./external/PeripheryPayments.sol";
import "./external/IUniswapV3FlashCallback.sol";
import "./external/CallbackValidation.sol";

/// @title Compound V3 Flash Loan Liquidator
/// @notice Executes liquidations on Compound V3 using Uniswap V3 flash loans
/// @dev Uses flash loans to acquire base token, purchases seized collateral at discount, swaps back to repay
contract Liquidator is IUniswapV3FlashCallback, PeripheryPayments, Ownable {
    error SlippageError();
    error UnauthorizedCaller();
    error NoProfit();

    uint256 constant DIVISOR = 1e18;

    CometInterface immutable compound;
    ISwapRouter immutable router;
    IUniswapV3Pool immutable flashLoanPool;
    address immutable weth;
    address immutable baseToken;
    address immutable poolFactory;
    uint256 immutable baseScale;

    address[] public reserves;
    mapping(address => address[]) public paths;

    struct FlashCallbackData {
        address compound;
        uint256 amount;
        address payer;
        address[] collaterals;
        uint256[] collateralCosts;
    }

    constructor(
        address _compound,
        address _router,
        address _flashLoanPool,
        address _weth,
        address _poolFactory
    ) Ownable(msg.sender) PeripheryImmutableState(_poolFactory, _weth) {
        compound = CometInterface(_compound);
        router = ISwapRouter(_router);
        flashLoanPool = IUniswapV3Pool(_flashLoanPool);
        weth = _weth;
        poolFactory = _poolFactory;
        baseToken = compound.baseToken();
        baseScale = compound.baseScale();
    }

    /// @notice Adds a collateral token to the supported reserves list
    /// @param reserve The collateral token address to add
    function addReserves(address reserve) external onlyOwner {
        reserves.push(reserve);
    }

    /// @notice Removes the last collateral token from the reserves list
    function removeReserves() external onlyOwner {
        reserves.pop();
    }

    /// @notice Sets the Uniswap V3 swap path for a collateral token
    /// @param collateral The collateral token address
    /// @param path Array of pool addresses defining the swap route
    function setPath(address collateral, address[] calldata path) external onlyOwner {
        paths[collateral] = path;
    }

    /// @notice Entry point for executing liquidations
    /// @param payload ABI-encoded array of account addresses to liquidate
    function liquidate(bytes calldata payload) external onlyOwner {
        (address[] memory accounts) = abi.decode(payload, (address[]));
        _executeLiquidation(accounts);
    }

    /// @dev Internal liquidation logic
    /// @param accounts Array of undercollateralized accounts to absorb
    function _executeLiquidation(address[] memory accounts) internal {
        // Absorb undercollateralized accounts
        compound.absorb(msg.sender, accounts);

        // Check if buying collateral is enabled
        if (!compound.isBuyPaused()) {
            uint256 targetReserves = compound.targetReserves();
            uint256[] memory collateralCosts = new uint256[](reserves.length);
            uint256 totalCollateralCost = 0;
            uint256 purchasableCount = 0;
            uint256 baseReserves = compound.getCollateralReserves(baseToken);

            // Only proceed if protocol needs more base reserves
            if (baseReserves < targetReserves) {
                // Calculate cost to purchase each collateral type
                for (uint256 i = 0; i < reserves.length; i++) {
                    uint256 collateralReserve = compound.getCollateralReserves(reserves[i]);

                    if (collateralReserve > 0) {
                        uint256 quote = compound.quoteCollateral(reserves[i], baseScale * DIVISOR);
                        collateralCosts[i] = baseScale * collateralReserve * DIVISOR / quote;
                        totalCollateralCost += collateralCosts[i];
                        purchasableCount++;
                    }
                }

                // Build array of purchasable collaterals
                address[] memory purchasableCollaterals = new address[](purchasableCount);
                for (uint256 k = 0; k < reserves.length; k++) {
                    if (collateralCosts[k] > 0) {
                        purchasableCollaterals[k] = reserves[k];
                    }
                }

                // Initiate flash loan if there's collateral to purchase
                if (totalCollateralCost > 0) {
                    flashLoanPool.flash(
                        address(this),
                        flashLoanPool.token0() > flashLoanPool.token1() ? totalCollateralCost : 0,
                        flashLoanPool.token0() > flashLoanPool.token1() ? 0 : totalCollateralCost,
                        abi.encode(
                            FlashCallbackData({
                                compound: address(compound),
                                amount: totalCollateralCost,
                                payer: msg.sender,
                                collaterals: purchasableCollaterals,
                                collateralCosts: collateralCosts
                            })
                        )
                    );
                }
            }
        }
    }

    /// @notice Uniswap V3 flash loan callback
    /// @dev Purchases collateral, swaps to base token, repays loan, sends profit to owner
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external override {
        FlashCallbackData memory decoded = abi.decode(data, (FlashCallbackData));

        // Verify callback is from the expected flash loan pool
        if (msg.sender != address(flashLoanPool)) revert UnauthorizedCaller();

        // Approve Compound to spend base token
        TransferHelper.safeApprove(baseToken, address(compound), decoded.amount);

        uint256 totalAmountOut;

        // Process each collateral type
        for (uint256 i = 0; i < decoded.collaterals.length; i++) {
            address collateral = decoded.collaterals[i];
            uint256 collateralCost = decoded.collateralCosts[i];
            address[] memory poolPath = paths[collateral];

            if (collateralCost > 0) {
                // Purchase collateral from Compound at discount
                compound.buyCollateral(collateral, 0, collateralCost, address(this));

                // Swap collateral back to base token (skip if collateral is base token)
                if (collateral != baseToken) {
                    uint256 balance = IERC20(collateral).balanceOf(address(this));
                    TransferHelper.safeApprove(collateral, address(router), balance);

                    // Determine if we need an intermediate hop through WETH
                    bool hop = collateral == weth ? false : true;

                    if (hop) {
                        // First swap: collateral -> WETH
                        router.exactInputSingle(
                            ISwapRouter.ExactInputSingleParams({
                                tokenIn: collateral,
                                tokenOut: weth,
                                fee: IUniswapV3Pool(poolPath[0]).fee(),
                                recipient: address(this),
                                amountIn: balance,
                                amountOutMinimum: 0,
                                sqrtPriceLimitX96: 0
                            })
                        );
                    }

                    // Final swap: WETH (or collateral) -> base token
                    uint256 wethBalance = IERC20(weth).balanceOf(address(this));
                    TransferHelper.safeApprove(weth, address(router), wethBalance);

                    uint256 baseAmountOut = router.exactInputSingle(
                        ISwapRouter.ExactInputSingleParams({
                            tokenIn: hop ? weth : collateral,
                            tokenOut: baseToken,
                            fee: IUniswapV3Pool(poolPath[poolPath.length - 1]).fee(),
                            recipient: address(this),
                            amountIn: wethBalance,
                            amountOutMinimum: 0,
                            sqrtPriceLimitX96: 0
                        })
                    );

                    // Verify we received at least what we paid
                    if (decoded.collateralCosts[i] > baseAmountOut) revert SlippageError();
                    totalAmountOut += baseAmountOut;
                }
            }
        }

        // Repay flash loan
        uint256 debt = decoded.amount + fee0 + fee1;
        uint256 afterBalance = IERC20(baseToken).balanceOf(address(this));

        if (debt > afterBalance) revert NoProfit();

        TransferHelper.safeApprove(baseToken, address(this), debt);
        pay(baseToken, address(this), msg.sender, debt);

        // Send remaining profit to owner
        uint256 profit = IERC20(baseToken).balanceOf(address(this));
        pay(baseToken, address(this), owner(), profit);
    }
}
