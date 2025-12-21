const {buildTransaction} = require('./pantheon_utils/web3Operations')
const { web3 } = require("./pantheon_utils/web3");
const {sendTransactionAndProcessIncommingTx} = require("./lib/helpers")
const {test} = require("./Tester")
const valueInEther = "0"
let addressTo
const {fileNameStimulus,fileNameResponse} = require('./ParametersSmartContractSending')

const {deploy} = require('./deployPublicSmartContract')
const isContractAddress = process.env.SMART_CONTRACT_ADDRESS || process.env.INTERBANK_CONTRACT_ADDRESS
const {set} = require('./changeSmartContractState')
let txData

const getSmartContractParameters = async() => {
  // For InterbankTransfer (option 5), always use existing contract
  if (process.env.SMART_CONTRACT_OPTION == 5) {
    if (!isContractAddress) {
      throw new Error('INTERBANK_CONTRACT_ADDRESS must be set for InterbankTransfer test')
    }
    addressTo = isContractAddress
    console.log("Using existing InterbankTransfer contract address", addressTo)
  } else if (isContractAddress) {
    addressTo = isContractAddress
    console.log("Using existing contract address", addressTo)
  } else {
    addressTo = await deploy()
  }

  txData = set()  
}

// Nonce cache per account to optimize performance
const nonceCache = new Map();

const publishSmartContractTransaction = async(privKey,t1,numberOfTransactions) => {
  try {
    // Convert Buffer to hex string
    const privKeyHex = privKey.toString('hex');
    const privKeyWithPrefix = privKeyHex.startsWith('0x') ? privKeyHex : '0x' + privKeyHex;
    
    // Get sender address from private key
    const senderAddress = web3.eth.accounts.privateKeyToAccount(privKeyWithPrefix);
    const address = senderAddress.address;
    
    // Get nonce with caching and retry logic
    let txCount;
    if (nonceCache.has(address)) {
      // Use cached nonce and increment
      txCount = nonceCache.get(address) + 1;
      nonceCache.set(address, txCount);
    } else {
      // First time: get from blockchain
      txCount = await web3.eth.getTransactionCount(address, 'pending');
      nonceCache.set(address, txCount);
    }
    
    // Verify nonce is not too far ahead (safety check)
    const blockchainNonce = await web3.eth.getTransactionCount(address, 'pending');
    if (txCount > blockchainNonce + 10) {
      // Reset if too far ahead
      console.warn(`⚠️  Nonce too far ahead for ${address.substring(0, 10)}... Resetting from ${txCount} to ${blockchainNonce}`);
      txCount = blockchainNonce;
      nonceCache.set(address, txCount);
    }
    
    const txObject = buildTransaction(txCount,addressTo,valueInEther,txData)
    sendTransactionAndProcessIncommingTx(txObject,privKey,t1,fileNameResponse,numberOfTransactions)
  } catch (error) {
    // On error, reset nonce cache for this account and retry
    const privKeyHex = privKey.toString('hex');
    const privKeyWithPrefix = privKeyHex.startsWith('0x') ? privKeyHex : '0x' + privKeyHex;
    const senderAddress = web3.eth.accounts.privateKeyToAccount(privKeyWithPrefix);
    const address = senderAddress.address;
    
    // Clear cache and get fresh nonce
    nonceCache.delete(address);
    try {
      const txCount = await web3.eth.getTransactionCount(address, 'pending');
      nonceCache.set(address, txCount);
      const txObject = buildTransaction(txCount,addressTo,valueInEther,txData)
      sendTransactionAndProcessIncommingTx(txObject,privKey,t1,fileNameResponse,numberOfTransactions)
    } catch (retryError) {
      // Final fallback to nonce 0
      console.error(`❌ Error with nonce management for ${address.substring(0, 10)}...: ${retryError.message}`);
      const txObject = buildTransaction(0,addressTo,valueInEther,txData)
      sendTransactionAndProcessIncommingTx(txObject,privKey,t1,fileNameResponse,numberOfTransactions)
    }
  }
}

const execSmartContractTest = async() => {
  await getSmartContractParameters()
  test(fileNameStimulus,publishSmartContractTransaction)
}

module.exports = {execSmartContractTest}