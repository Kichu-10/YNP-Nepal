const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    throw new Error("YNP may only be deployed to the local Hardhat network.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const YNPTestToken = await hre.ethers.getContractFactory("YNPTestToken");
  const token = await YNPTestToken.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  const configPath = path.join(__dirname, "..", "..", "frontend", "config.js");
  const config = `window.YNP_CONFIG = {\n  contractAddress: "${address}",\n  expectedChainId: 31337,\n};\n`;
  fs.writeFileSync(configPath, config);

  console.log("YNP Test Token deployed to:", address);
  console.log("Deployer:", deployer.address);
  console.log("Updated frontend/config.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
