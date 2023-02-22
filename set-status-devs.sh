#!/usr/bin/env bash

WALLETS_FILE=$1
NETWORK=tevmos

echo "Mint shares"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint-share WALLET 1 --network $NETWORK
echo "Set MANAGING_BOARD status"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat set --account WALLET --status managing_board --network $NETWORK
echo "Mint tokens"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint --account WALLET --amount 42 --network $NETWORK
