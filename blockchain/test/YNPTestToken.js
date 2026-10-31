const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YNPTestToken", function () {
  const INITIAL_SUPPLY = ethers.parseEther("21000000");

  async function deployToken() {
    const [owner, recipient, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("YNPTestToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    return { token, owner, recipient, other };
  }

  it("uses the expected name, symbol, decimals and fixed supply", async function () {
    const { token, owner } = await deployToken();
    expect(await token.name()).to.equal("YNP Test Token");
    expect(await token.symbol()).to.equal("YNP");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
  });

  it("transfers tokens and emits a Transfer event", async function () {
    const { token, owner, recipient } = await deployToken();
    const amount = ethers.parseEther("1250");

    await expect(token.transfer(recipient.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, recipient.address, amount);

    expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - amount);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
  });

  it("rejects transfers above the sender balance", async function () {
    const { token, recipient, owner } = await deployToken();
    await expect(token.transfer(recipient.address, INITIAL_SUPPLY + 1n)).to.be.reverted;
    expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
  });

  it("does not reduce supply after transfers", async function () {
    const { token, recipient, owner } = await deployToken();
    await token.transfer(recipient.address, ethers.parseEther("500"));
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("does not expose an additional mint function", async function () {
    const { token } = await deployToken();
    expect(token.interface.getFunction("mint")).to.equal(null);
  });
});
