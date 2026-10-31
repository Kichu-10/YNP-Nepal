const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const state = {
  provider: null,
  signer: null,
  contract: null,
  account: null,
  decimals: 18,
  balance: null,
  transferListener: null
};

const elements = {
  notice: document.getElementById("wallet-notice"),
  connect: document.getElementById("connect-wallet"),
  navConnect: document.getElementById("nav-connect"),
  address: document.getElementById("wallet-address"),
  walletSubtext: document.getElementById("wallet-subtext"),
  balance: document.getElementById("token-balance"),
  supply: document.getElementById("total-supply"),
  networkStatus: document.getElementById("network-status"),
  networkChip: document.getElementById("network-chip"),
  contractAddress: document.getElementById("contract-address"),
  form: document.getElementById("send-form"),
  recipient: document.getElementById("recipient"),
  amount: document.getElementById("amount"),
  sendButton: document.getElementById("send-button"),
  message: document.getElementById("send-message"),
  history: document.getElementById("transaction-history"),
  refresh: document.getElementById("refresh-history"),
  maxButton: document.getElementById("max-button")
};

function setNotice(message, kind = "") {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ""}`;
}

function showSendMessage(message, success = false) {
  elements.message.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = `toast${success ? " success" : ""}`;
  toast.textContent = message;
  elements.message.appendChild(toast);
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isConfigReady() {
  const address = window.YNP_CONFIG?.contractAddress?.trim();
  return ethers.isAddress(address);
}

function formatError(error) {
  if (error?.info?.error?.message) return error.info.error.message;
  if (error?.reason) return error.reason;
  if (error?.shortMessage) return error.shortMessage;
  if (error?.message) return error.message;
  return "The transaction could not be completed.";
}

async function ensureLocalNetwork() {
  if (!window.ethereum) throw new Error("MetaMask is not installed. Install the MetaMask browser extension.");

  const expectedId = window.YNP_CONFIG?.expectedChainId || 31337;
  let chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (Number.parseInt(chainId, 16) !== expectedId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${expectedId.toString(16)}` }]
      });
    } catch (switchError) {
      if (switchError.code !== 4902) throw switchError;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: `0x${expectedId.toString(16)}`,
          chainName: "Hardhat Local",
          nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"],
          blockExplorerUrls: null
        }]
      });
    }
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Install MetaMask, then reload this page.");
    if (typeof ethers === "undefined") throw new Error("Ethers.js could not load. Check your internet connection and reload.");
    if (!isConfigReady()) throw new Error("Contract address is not configured. Deploy the contract and update frontend/config.js.");

    await ensureLocalNetwork();
    state.provider = new ethers.BrowserProvider(window.ethereum);
    await state.provider.send("eth_requestAccounts", []);
    state.signer = await state.provider.getSigner();
    state.account = await state.signer.getAddress();
    state.contract = new ethers.Contract(window.YNP_CONFIG.contractAddress.trim(), TOKEN_ABI, state.signer);
    state.decimals = await state.contract.decimals();

    elements.connect.textContent = "Connected";
    elements.navConnect.textContent = "Wallet connected";
    elements.address.textContent = shortenAddress(state.account);
    elements.address.title = state.account;
    elements.walletSubtext.textContent = state.account;
    elements.contractAddress.textContent = `Contract: ${shortenAddress(window.YNP_CONFIG.contractAddress.trim())}`;
    elements.contractAddress.title = window.YNP_CONFIG.contractAddress.trim();

    await refreshWalletData();
    setNotice("Wallet connected to the Hardhat local network.", "success");
    await loadHistory();
  } catch (error) {
    setNotice(formatError(error), "error");
  }
}

async function refreshWalletData() {
  if (!state.provider || !state.contract || !state.account) return;
  try {
    const network = await state.provider.getNetwork();
    const expectedId = window.YNP_CONFIG?.expectedChainId || 31337;
    if (Number(network.chainId) !== expectedId) {
      elements.networkStatus.textContent = "Wrong network";
      elements.networkChip.innerHTML = '<span class="status-dot"></span> Wrong network';
      setNotice(`Switch MetaMask to Hardhat Local (chain ID ${expectedId}).`, "error");
      elements.balance.textContent = "—";
      elements.supply.textContent = "—";
      return;
    }

    const [balance, totalSupply] = await Promise.all([
      state.contract.balanceOf(state.account),
      state.contract.totalSupply()
    ]);
    state.balance = balance;
    elements.balance.textContent = Number(ethers.formatUnits(balance, state.decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 6
    });
    elements.supply.textContent = Number(ethers.formatUnits(totalSupply, state.decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 0
    });
    elements.networkStatus.textContent = `Connected · ${network.chainId}`;
    elements.networkChip.innerHTML = '<span class="status-dot"></span> Hardhat local';
  } catch (error) {
    setNotice(formatError(error), "error");
  }
}

async function sendTokens(event) {
  event.preventEvent?.();
  event.preventDefault();
  if (!state.contract || !state.account) {
    showSendMessage("Connect your wallet before sending tokens.");
    return;
  }

  const recipient = elements.recipient.value.trim();
  const rawAmount = elements.amount.value.trim();
  if (!ethers.isAddress(recipient)) {
    showSendMessage("Enter a valid recipient wallet address.");
    return;
  }
  if (recipient.toLowerCase() === state.account.toLowerCase()) {
    showSendMessage("Choose a recipient address different from your wallet.");
    return;
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawAmount)) {
    showSendMessage("Enter a valid positive amount.");
    return;
  }

  try {
    const amount = ethers.parseUnits(rawAmount, state.decimals);
    if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
    if (state.balance !== null && amount > state.balance) throw new Error("Amount exceeds your YNP balance.");

    elements.sendButton.disabled = true;
    elements.sendButton.textContent = "Confirm in MetaMask...";
    const transaction = await state.contract.transfer(recipient, amount);
    showSendMessage(`Transaction submitted: ${transaction.hash}`);
    const receipt = await transaction.wait();
    showSendMessage(
      receipt.status === 1
        ? `Transfer confirmed in block ${receipt.blockNumber}.`
        : "Transfer transaction failed.",
      receipt.status === 1
    );
    await refreshWalletData();
    await loadHistory();
  } catch (error) {
    showSendMessage(formatError(error));
  } finally {
    elements.sendButton.disabled = false;
    elements.sendButton.textContent = "Send test tokens";
  }
}

async function loadHistory() {
  if (!state.contract || !state.provider) {
    elements.history.innerHTML = '<tr><td colspan="4"><div class="empty-state">Connect MetaMask to load Transfer events.</div></td></tr>';
    return;
  }

  elements.history.innerHTML = '<tr><td colspan="4"><div class="empty-state">Loading on-chain Transfer events...</div></td></tr>';
  try {
    const latest = await state.provider.getBlockNumber();
    const events = await state.contract.queryFilter(state.contract.filters.Transfer(), 0, latest);
    events.sort((a, b) => b.blockNumber - a.blockNumber);
    const relevant = events.filter((event) =>
      !state.account ||
      event.args.from.toLowerCase() === state.account.toLowerCase() ||
      event.args.to.toLowerCase() === state.account.toLowerCase()
    );

    if (!relevant.length) {
      elements.history.innerHTML = '<tr><td colspan="4"><div class="empty-state">No transfer events for the connected wallet.</div></td></tr>';
      return;
    }

    elements.history.innerHTML = "";
    const blockCache = new Map();
    for (const event of relevant.slice(0, 20)) {
      if (!blockCache.has(event.blockNumber)) {
        blockCache.set(event.blockNumber, await state.provider.getBlock(event.blockNumber));
      }
      const block = blockCache.get(event.blockNumber);
      const receipt = await state.provider.getTransactionReceipt(event.transactionHash);
      const amount = ethers.formatUnits(event.args.value, state.decimals);
      const timestamp = block ? new Date(Number(block.timestamp) * 1000).toLocaleString() : "Timestamp unavailable";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <span class="address">${shortenAddress(event.args.from)}</span>
          <span class="muted"> → </span>
          <span class="address">${shortenAddress(event.args.to)}</span>
          <div class="muted">${timestamp}</div>
        </td>
        <td>${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} YNP</td>
        <td><a class="tx-link address" href="#" title="${event.transactionHash}" data-hash="${event.transactionHash}" aria-label="Transaction ${event.transactionHash}">${shortenAddress(event.transactionHash)}</a></td>
        <td><span class="tx-status">${receipt?.status === 1 ? "Confirmed" : "Pending/failed"}</span></td>`;
      elements.history.appendChild(row);
    }
  } catch (error) {
    elements.history.innerHTML = `<tr><td colspan="4"><div class="empty-state">${formatError(error)}</div></td></tr>`;
  }
}

function handleAccountsChanged(accounts) {
  if (!accounts.length) {
    state.account = null;
    state.signer = null;
    state.contract = null;
    elements.address.textContent = "Not connected";
    elements.walletSubtext.textContent = "MetaMask account";
    elements.balance.textContent = "—";
    elements.connect.textContent = "Connect MetaMask";
    elements.navConnect.textContent = "Connect wallet";
    setNotice("MetaMask account disconnected.");
    loadHistory();
    return;
  }
  connectWallet();
}

async function handleChainChanged() {
  await connectWallet();
}

elements.connect.addEventListener("click", connectWallet);
elements.navConnect.addEventListener("click", () => {
  document.getElementById("dashboard").scrollIntoView({ behavior: "smooth" });
  connectWallet();
});
elements.form.addEventListener("submit", sendTokens);
elements.refresh.addEventListener("click", loadHistory);
elements.maxButton.addEventListener("click", () => {
  if (state.balance === null) {
    showSendMessage("Connect your wallet to use your available balance.");
    return;
  }
  elements.amount.value = ethers.formatUnits(state.balance, state.decimals);
});

document.querySelector(".nav-toggle").addEventListener("click", (event) => {
  const links = document.getElementById("nav-links");
  const open = links.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => document.getElementById("nav-links").classList.remove("open"));
});

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", handleChainChanged);
}

if (!window.ethereum) {
  setNotice("MetaMask is not installed. Install it to use wallet features.");
} else if (!isConfigReady()) {
  setNotice("Contract address not configured. Deploy locally and update frontend/config.js.", "error");
} else {
  window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
    if (accounts.length) connectWallet();
  }).catch(() => {});
}
