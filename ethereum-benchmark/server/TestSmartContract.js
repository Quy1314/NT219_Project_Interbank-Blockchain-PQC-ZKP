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

const publishSmartContractTransaction = async(privKey,t1,numberOfTransactions) => {
  try {
    // Convert Buffer to hex string
    const privKeyHex = privKey.toString('hex');
    const privKeyWithPrefix = privKeyHex.startsWith('0x') ? privKeyHex : '0x' + privKeyHex;
    
    // Get sender address from private key
    const senderAddress = web3.eth.accounts.privateKeyToAccount(privKeyWithPrefix);
    
    // Get current nonce for this account (important for multi-account)
    const txCount = await web3.eth.getTransactionCount(senderAddress.address, 'pending');

    const txObject = buildTransaction(txCount,addressTo,valueInEther,txData)
    sendTransactionAndProcessIncommingTx(txObject,privKey,t1,fileNameResponse,numberOfTransactions)
  } catch (error) {
    // Fallback to nonce 0 if error (for compatibility)
    const txObject = buildTransaction(0,addressTo,valueInEther,txData)
    sendTransactionAndProcessIncommingTx(txObject,privKey,t1,fileNameResponse,numberOfTransactions)
  }
}

const execSmartContractTest = async() => {
  await getSmartContractParameters()
  test(fileNameStimulus,publishSmartContractTransaction)
}

module.exports = {execSmartContractTest}