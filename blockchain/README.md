# YNP Blockchain

## Setup

```powershell
cd blockchain
npm install
npm run compile
npm test
```

## Run the local network

In terminal 1:

```powershell
npm run node
```

Keep it running.

## Deploy locally

In terminal 2:

```powershell
cd blockchain
npm run deploy:local
```

The deployment script writes the deployed contract address into `frontend/config.js`.

## MetaMask setup

1. Install MetaMask.
2. Add a custom network:
   - Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
3. Import a development account by copying a private key shown by `npm run node`.
4. Never use a development private key outside local testing.
