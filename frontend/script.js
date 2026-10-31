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
  transferListener: null,
  historyEvents: [],
  historyPage: 1,
  historyPageSize: 10
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
  maxButton: document.getElementById("max-button"),
  historyRange: document.getElementById("history-range"),
  historySummary: document.getElementById("history-summary"),
  historyPrev: document.getElementById("history-prev"),
  historyNext: document.getElementById("history-next"),
  historyPage: document.getElementById("history-page"),
  transactionDialog: document.getElementById("transaction-dialog"),
  transactionDetails: document.getElementById("transaction-details")
};

function expectedChainId() {
  return Number(window.YNP_CONFIG?.expectedChainId || 31337);
}

function setNotice(message, kind = "") {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ""}`;
}

function showSendMessage(message, kind = "") {
  elements.message.replaceChildren();
  const toast = document.createElement("div");
  toast.className = `toast${kind ? ` ${kind}` : ""}`;
  toast.textContent = message;
  elements.message.appendChild(toast);
}

function shortenAddress(address) {
  if (typeof address !== "string" || address.length < 12) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function setNetworkChip(message) {
  elements.networkChip.replaceChildren();
  const dot = document.createElement("span");
  dot.className = "status-dot";
  elements.networkChip.append(dot, document.createTextNode(` ${message}`));
}

function isConfigReady() {
  const address = window.YNP_CONFIG?.contractAddress?.trim();
  return typeof ethers !== "undefined" && ethers.isAddress(address);
}

function formatError(error) {
  if (error?.code === 4001) return "Transaction rejected in MetaMask.";
  if (error?.code === -32002) return "A MetaMask request is already pending. Complete it before continuing.";
  if (error?.info?.error?.message) return String(error.info.error.message);
  if (error?.reason) return String(error.reason);
  if (error?.shortMessage) return String(error.shortMessage);
  if (error?.message) return String(error.message);
  return "The request could not be completed.";
}

async function readChainId() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  return Number.parseInt(chainId, 16);
}

async function ensureExpectedNetwork({ offerSwitch = true } = {}) {
  const currentId = await readChainId();
  const expectedId = expectedChainId();
  if (currentId === expectedId) return true;
  if (!offerSwitch) throw new Error(`Switch MetaMask to Hardhat Local (chain ID ${expectedId}).`);

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

  const afterSwitchId = await readChainId();
  if (afterSwitchId !== expectedId) throw new Error(`MetaMask must remain on chain ID ${expectedId}.`);
  return true;
}

function resetWalletUi({ message = "Connect MetaMask to the local Hardhat network." } = {}) {
  state.provider = null;
  state.signer = null;
  state.contract = null;
  state.account = null;
  state.balance = null;
  elements.address.textContent = "Not connected";
  elements.walletSubtext.textContent = "MetaMask account";
  elements.balance.textContent = "—";
  elements.supply.textContent = "—";
  elements.networkStatus.textContent = "Not connected";
  elements.contractAddress.textContent = "Contract: not configured";
  elements.connect.textContent = "Connect MetaMask";
  elements.navConnect.textContent = "Connect wallet";
  setNotice(message);
  showDisconnectedHistory();
}

function resetNetworkUi() {
  if (state.contract && state.transferListener) {
    state.contract.off("Transfer", state.transferListener);
  }
  state.transferListener = null;
  state.signer = null;
  state.contract = null;
  state.balance = null;
  elements.networkStatus.textContent = "Wrong network";
  elements.balance.textContent = "—";
  elements.supply.textContent = "—";
  elements.connect.textContent = "Switch network";
  setNetworkChip("Wrong network");
  setNotice(`Switch MetaMask to Hardhat Local (chain ID ${expectedChainId()}).`, "error");
}

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Install MetaMask, then reload.");
    if (typeof ethers === "undefined") throw new Error("Ethers.js could not load. Reload the page.");
    if (!isConfigReady()) throw new Error("Contract address is not configured. Deploy locally and update frontend/config.js.");

    elements.connect.disabled = true;
    elements.connect.textContent = "Connecting...";
    setNotice("Checking MetaMask network and wallet...");
    await ensureExpectedNetwork({ offerSwitch: true });

    state.provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await state.provider.send("eth_requestAccounts", []);
    if (!accounts.length) throw new Error("No MetaMask account is available.");

    state.signer = await state.provider.getSigner();
    state.account = await state.signer.getAddress();
    state.contract = new ethers.Contract(window.YNP_CONFIG.contractAddress.trim(), TOKEN_ABI, state.signer);
    state.decimals = await state.contract.decimals();

    if (state.transferListener) {
      state.contract.off("Transfer", state.transferListener);
    }
    state.transferListener = async () => {
      await refreshWalletData();
      await loadHistory();
    };
    state.contract.on("Transfer", state.transferListener);

    elements.connect.disabled = false;
    elements.connect.textContent = "Connected";
    elements.navConnect.textContent = "Wallet connected";
    elements.address.textContent = shortenAddress(state.account);
    elements.address.title = state.account;
    elements.walletSubtext.textContent = state.account;
    elements.contractAddress.textContent = `Contract: ${shortenAddress(window.YNP_CONFIG.contractAddress.trim())}`;
    elements.contractAddress.title = window.YNP_CONFIG.contractAddress.trim();

    await refreshWalletData();
    await loadHistory();
  } catch (error) {
    elements.connect.disabled = false;
    elements.connect.textContent = "Connect MetaMask";
    setNotice(formatError(error), "error");
  }
}

async function refreshWalletData() {
  if (!state.provider || !state.contract || !state.account) return;
  try {
    const currentId = await readChainId();
    if (currentId !== expectedChainId()) {
      resetNetworkUi();
      return;
    }
    const network = await state.provider.getNetwork();
    if (Number(network.chainId) !== expectedChainId()) {
      resetNetworkUi();
      return;
    }

    elements.balance.textContent = "Loading...";
    elements.supply.textContent = "Loading...";
    const [balance, totalSupply] = await Promise.all([
      state.contract.balanceOf(state.account),
      state.contract.totalSupply()
    ]);
    state.balance = balance;
    elements.balance.textContent = `${YNPUtils.formatTokenAmount(ethers.formatUnits(balance, state.decimals), 6)} YNP`;
    elements.supply.textContent = `${YNPUtils.formatTokenAmount(ethers.formatUnits(totalSupply, state.decimals), 0)} YNP`;
    elements.networkStatus.textContent = `Connected · ${network.chainId}`;
    setNetworkChip("Hardhat local");
    setNotice("Wallet connected to the Hardhat local network.", "success");
  } catch (error) {
    setNotice(formatError(error), "error");
  }
}

async function verifyTransferWalletAndNetwork() {
  await ensureExpectedNetwork({ offerSwitch: false });
  if (!state.provider || !state.account) throw new Error("Connect your wallet before sending tokens.");

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts.length) throw new Error("MetaMask account disconnected. Reconnect your wallet.");
  const activeAddress = accounts[0].toLowerCase();
  if (activeAddress !== state.account.toLowerCase()) {
    throw new Error("The active MetaMask account changed. Connect your wallet again.");
  }

  state.provider = new ethers.BrowserProvider(window.ethereum);
  state.signer = await state.provider.getSigner();
  if (state.contract && state.transferListener) {
    state.contract.off("Transfer", state.transferListener);
  }
  state.contract = new ethers.Contract(window.YNP_CONFIG.contractAddress.trim(), TOKEN_ABI, state.signer);
  state.decimals = await state.contract.decimals();
  state.transferListener = async () => {
    await refreshWalletData();
    await loadHistory();
  };
  state.contract.on("Transfer", state.transferListener);
}

async function sendTokens(event) {
  event.preventDefault();
  if (!state.contract || !state.account) {
    showSendMessage("Connect your wallet before sending tokens.", "error");
    return;
  }

  const recipient = elements.recipient.value.trim();
  const rawAmount = elements.amount.value.trim();
  if (!ethers.isAddress(recipient)) {
    showSendMessage("Enter a valid recipient wallet address.", "error");
    return;
  }
  if (recipient.toLowerCase() === state.account.toLowerCase()) {
    showSendMessage("Choose a recipient address different from your wallet.", "error");
    return;
  }
  if (!YNPUtils.isValidPositiveAmount(rawAmount, state.decimals)) {
    showSendMessage(`Enter a positive amount with at most ${state.decimals} decimal places.`, "error");
    return;
  }

  try {
    await verifyTransferWalletAndNetwork();
    const amount = ethers.parseUnits(rawAmount, state.decimals);
    const currentBalance = await state.contract.balanceOf(state.account);
    state.balance = currentBalance;
    if (amount > currentBalance) throw new Error("Amount exceeds your current YNP balance.");

    elements.sendButton.disabled = true;
    elements.sendButton.textContent = "Confirm in MetaMask...";
    showSendMessage("Waiting for MetaMask confirmation...", "pending");
    const transaction = await state.contract.transfer(recipient, amount);
    showSendMessage(`Transaction submitted: ${shortenAddress(transaction.hash)}. Waiting for confirmation.`, "pending");
    const receipt = await transaction.wait();
    if (receipt.status !== 1) throw new Error("The transfer transaction was not confirmed.");
    showSendMessage(`Transfer confirmed in block ${receipt.blockNumber}.`, "success");
    await refreshWalletData();
    await loadHistory();
  } catch (error) {
    showSendMessage(formatError(error), "error");
  } finally {
    elements.sendButton.disabled = false;
    elements.sendButton.textContent = "Send test tokens";
  }
}

function showDisconnectedHistory() {
  state.historyEvents = [];
  state.historyPage = 1;
  elements.history.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "Connect MetaMask to load Transfer events.";
  cell.appendChild(empty);
  row.appendChild(cell);
  elements.history.appendChild(row);
  elements.historySummary.textContent = "";
  elements.historyPage.textContent = "Page 1";
  elements.historyPrev.disabled = true;
  elements.historyNext.disabled = true;
}

async function loadHistory() {
  if (!state.contract || !state.provider || !state.account) {
    showDisconnectedHistory();
    return;
  }

  elements.history.replaceChildren();
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 4;
  const loading = document.createElement("div");
  loading.className = "empty-state loading-state";
  loading.textContent = "Loading on-chain Transfer events";
  loadingCell.appendChild(loading);
  loadingRow.appendChild(loadingCell);
  elements.history.appendChild(loadingRow);
  elements.historySummary.textContent = "Reading local blocks...";

  try {
    await ensureExpectedNetwork({ offerSwitch: false });
    const latest = await state.provider.getBlockNumber();
    const range = elements.historyRange.value;
    const fromBlock = range === "latest" ? 0 : Math.max(0, latest - Number(range));
    const events = await state.contract.queryFilter(state.contract.filters.Transfer(), fromBlock, latest);
    events.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    state.historyEvents = events.filter((event) =>
      event.args.from.toLowerCase() === state.account.toLowerCase() ||
      event.args.to.toLowerCase() === state.account.toLowerCase()
    );
    state.historyPage = 1;
    elements.historySummary.textContent = `Blocks ${fromBlock}-${latest} · ${state.historyEvents.length} transfer(s)`;
    renderHistoryPage();
  } catch (error) {
    state.historyEvents = [];
    elements.history.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = formatError(error);
    cell.appendChild(empty);
    row.appendChild(cell);
    elements.history.appendChild(row);
    elements.historySummary.textContent = "";
    elements.historyPrev.disabled = true;
    elements.historyNext.disabled = true;
  }
}

function renderHistoryPage() {
  elements.history.replaceChildren();
  if (!state.historyEvents.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No transfer events for this wallet in the selected block range.";
    cell.appendChild(empty);
    row.appendChild(cell);
    elements.history.appendChild(row);
    elements.historyPage.textContent = "Page 1";
    elements.historyPrev.disabled = true;
    elements.historyNext.disabled = true;
    return;
  }

  const pageCount = Math.ceil(state.historyEvents.length / state.historyPageSize);
  state.historyPage = Math.min(Math.max(state.historyPage, 1), pageCount);
  const start = (state.historyPage - 1) * state.historyPageSize;
  const pageEvents = state.historyEvents.slice(start, start + state.historyPageSize);

  pageEvents.forEach((event) => {
    const row = document.createElement("tr");
    const transferCell = document.createElement("td");
    const from = document.createElement("span");
    from.className = "address";
    from.textContent = shortenAddress(event.args.from);
    const arrow = document.createElement("span");
    arrow.className = "muted";
    arrow.textContent = " → ";
    const to = document.createElement("span");
    to.className = "address";
    to.textContent = shortenAddress(event.args.to);
    const timestamp = document.createElement("div");
    timestamp.className = "muted";
    timestamp.textContent = "Block " + event.blockNumber;
    transferCell.append(from, arrow, to, timestamp);
    state.provider.getBlock(event.blockNumber).then((block) => {
      timestamp.textContent = block
        ? new Date(Number(block.timestamp) * 1000).toLocaleString()
        : `Block ${event.blockNumber}`;
    }).catch(() => {
      timestamp.textContent = `Block ${event.blockNumber}`;
    });

    const amountCell = document.createElement("td");
    amountCell.textContent = `${YNPUtils.formatTokenAmount(ethers.formatUnits(event.args.value, state.decimals), 6)} YNP`;

    const hashCell = document.createElement("td");
    const hashButton = document.createElement("button");
    hashButton.type = "button";
    hashButton.className = "tx-button";
    hashButton.textContent = YNPUtils.shortenHash(event.transactionHash, 6);
    hashButton.title = "Open transaction details";
    hashButton.addEventListener("click", () => openTransactionDetails(event.transactionHash));
    hashCell.appendChild(hashButton);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "tx-status";
    status.textContent = "Confirmed";
    statusCell.appendChild(status);

    row.append(transferCell, amountCell, hashCell, statusCell);
    elements.history.appendChild(row);
  });

  elements.historyPage.textContent = `Page ${state.historyPage} of ${pageCount}`;
  elements.historyPrev.disabled = state.historyPage <= 1;
  elements.historyNext.disabled = state.historyPage >= pageCount;
}

async function openTransactionDetails(hash) {
  elements.transactionDetails.replaceChildren();
  const loading = document.createElement("div");
  const loadingText = document.createElement("dd");
  loadingText.textContent = "Loading transaction details...";
  loading.append(document.createElement("dt"), loadingText);
  elements.transactionDetails.appendChild(loading);
  elements.transactionDialog.showModal();

  try {
    await ensureExpectedNetwork({ offerSwitch: false });
    const [transaction, receipt, latestBlock] = await Promise.all([
      state.provider.getTransaction(hash),
      state.provider.getTransactionReceipt(hash),
      state.provider.getBlockNumber()
    ]);
    const block = transaction?.blockNumber ? await state.provider.getBlock(transaction.blockNumber) : null;
    const details = [
      ["Hash", hash],
      ["Status", receipt ? (receipt.status === 1 ? "Confirmed" : "Failed") : "Pending"],
      ["Block", transaction?.blockNumber ? String(transaction.blockNumber) : "Pending"],
      ["Confirmations", transaction?.blockNumber ? String(latestBlock - transaction.blockNumber + 1) : "0"],
      ["Timestamp", block ? new Date(Number(block.timestamp) * 1000).toLocaleString() : "Unavailable"],
      ["From", transaction?.from || "Unavailable"],
      ["To", transaction?.to || "Unavailable"],
      ["Nonce", transaction?.nonce !== undefined ? String(transaction.nonce) : "Unavailable"],
      ["Gas used", receipt?.gasUsed ? receipt.gasUsed.toString() : "Unavailable"]
    ];
    elements.transactionDetails.replaceChildren();
    details.forEach(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      elements.transactionDetails.appendChild(row);
    });
  } catch (error) {
    elements.transactionDetails.replaceChildren();
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = "Error";
    description.textContent = formatError(error);
    row.append(term, description);
    elements.transactionDetails.appendChild(row);
  }
}

async function handleAccountsChanged(accounts) {
  if (!accounts.length) {
    if (state.contract && state.transferListener) state.contract.off("Transfer", state.transferListener);
    resetWalletUi({ message: "MetaMask account disconnected. Connect again to continue." });
    return;
  }
  await connectWallet();
}

async function handleChainChanged() {
  try {
    const currentId = await readChainId();
    if (currentId !== expectedChainId()) {
      resetNetworkUi();
      showDisconnectedHistory();
      return;
    }

    state.provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await state.provider.send("eth_accounts", []);
    if (!accounts.length) {
      resetWalletUi({ message: "Connect MetaMask to the local Hardhat network." });
      return;
    }
    await connectWallet();
  } catch (error) {
    setNotice(formatError(error), "error");
  }
}

elements.connect.addEventListener("click", connectWallet);
elements.navConnect.addEventListener("click", () => {
  document.getElementById("dashboard").scrollIntoView({ behavior: "smooth" });
  connectWallet();
});
elements.form.addEventListener("submit", sendTokens);
elements.refresh.addEventListener("click", loadHistory);
elements.historyRange.addEventListener("change", () => {
  state.historyPage = 1;
  loadHistory();
});
elements.historyPrev.addEventListener("click", () => {
  if (state.historyPage > 1) {
    state.historyPage -= 1;
    renderHistoryPage();
  }
});
elements.historyNext.addEventListener("click", () => {
  const pageCount = Math.ceil(state.historyEvents.length / state.historyPageSize);
  if (state.historyPage < pageCount) {
    state.historyPage += 1;
    renderHistoryPage();
  }
});
elements.maxButton.addEventListener("click", () => {
  if (state.balance === null) {
    showSendMessage("Connect your wallet to use your available balance.", "error");
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
  setNotice("MetaMask is not installed. Install it to use wallet features.", "error");
} else if (!isConfigReady()) {
  setNotice("Contract address not configured. Deploy locally and update frontend/config.js.", "error");
} else {
  window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
    if (accounts.length) connectWallet();
  }).catch(() => {});
}
