# YNP - Yeti Nepal Protocol

YNP is an early-stage blockchain research and local testnet MVP inspired by Nepal's Himalayan identity. It includes a premium static frontend and an OpenZeppelin ERC-20 test token deployed only to a local Hardhat network.

## Architecture

- `frontend/`: HTML, CSS and JavaScript dashboard with Ethers.js v6 and MetaMask integration.
- `blockchain/contracts/`: Solidity ERC-20 contract.
- `blockchain/scripts/`: Local deployment script.
- `blockchain/test/`: Automated contract tests.
- `backend/`: Existing Python dependency setup information. It is not used by the local blockchain MVP.

## Requirements

- Node.js 18 or later
- npm
- MetaMask browser extension
- Python 3 only if using the optional backend folder

## Frontend setup

Serve the static frontend from the repository root:

```powershell
cd frontend
python -m http.server 5500
```

Open `http://localhost:5500/index.html`.

## Blockchain setup

```powershell
cd blockchain
npm install
npm run compile
npm test
```

Start Hardhat:

```powershell
npm run node
```

In another terminal, deploy:

```powershell
cd blockchain
npm run deploy:local
```

The script writes the contract address to `frontend/config.js`. If you redeploy, keep the frontend server running and reload the browser.

## MetaMask setup

Add this network manually:

- Network name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: `ETH`

Import one account private key printed by the Hardhat node. Hardhat development keys are public test credentials and must never hold real funds.

## Features

- Wallet detection and connection
- Expected network verification
- Account and network change handling
- Token balance and fixed total supply
- Address and amount validation
- ERC-20 transfers through MetaMask
- Real Transfer event history
- No private-key collection or storage

## Test checklist

- Contract name, symbol, decimals and supply are correct
- Initial supply belongs only to the deployer
- Transfers emit events and update balances
- Insufficient balance transfers fail
- Transfers do not change total supply
- Frontend rejects an incorrect network
- Frontend validates addresses and positive decimal amounts
- MetaMask account and network changes update the dashboard
- Failed or rejected transactions show understandable errors

## Troubleshooting

- **MetaMask not found:** install the extension and reload.
- **Wrong network:** switch to chain ID `31337`; add the Hardhat RPC URL if missing.
- **Contract address missing:** restart and redeploy the Hardhat node, then run the deployment script.
- **Nonce errors:** MetaMask account state may be stale; reset the local account in MetaMask only for this development network.
- **Transaction fails:** confirm the recipient address, positive amount and enough YNP balance.
- **Frontend cannot read history:** confirm the contract address and check browser developer-console errors.

## Security scope

This MVP uses a fixed local test supply and is not a real currency, investment, payment service or public sale. Do not deploy to mainnet. A future public launch requires qualified legal review and regulatory clearance in Nepal.
