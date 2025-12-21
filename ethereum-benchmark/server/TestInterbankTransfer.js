const {buildTransaction} = require('./pantheon_utils/web3Operations')
const { web3 } = require("./pantheon_utils/web3");
const {sendTransactionAndProcessIncommingTx, getNonce, resetNonce} = require("./lib/helpers")
const {test} = require("./Tester")
const valueInEther = "0"
let contractAddress
const {fileNameStimulus,fileNameResponse} = require('./ParametersSmartContractSending')

// InterbankTransfer contract ABI
const InterbankTransferABI = require('./smartContract/build/InterbankTransfer/InterbankTransfer.json').abi
let contract

const getContractParameters = async() => {
  // Use existing deployed contract address
  contractAddress = process.env.SMART_CONTRACT_ADDRESS || process.env.INTERBANK_CONTRACT_ADDRESS
  
  if (!contractAddress) {
    throw new Error('SMART_CONTRACT_ADDRESS or INTERBANK_CONTRACT_ADDRESS must be set')
  }
  
  console.log("Using InterbankTransfer contract address:", contractAddress)
  
  // Create contract instance
  contract = new web3.eth.Contract(InterbankTransferABI, contractAddress)
  
  // Get transfer function data
  const toAddress = process.env.TO_ADDRESS || '0x0000000000000000000000000000000000000001'
  const amount = process.env.AMOUNT_WEI || web3.utils.toWei('0.001', 'ether')
  const toBankCode = process.env.TO_BANK_CODE || 'VCB'
  const description = `Lacchain benchmark transfer at ${Date.now()}`
  
  return {
    contractAddress,
    toAddress,
    amount,
    toBankCode,
    description
  }
}

const publishInterbankTransferTransaction = async(privKey, t1, numberOfTransactions) => {
  try {
    const params = await getContractParameters()
    
    // Convert Buffer to hex string
    const privKeyHex = privKey.toString('hex');
    const privKeyWithPrefix = privKeyHex.startsWith('0x') ? privKeyHex : '0x' + privKeyHex;
    
    // Get sender address from private key
    const senderAddress = web3.eth.accounts.privateKeyToAccount(privKeyWithPrefix);
    const address = senderAddress.address;
    
    // Get nonce with proper management
    const txCount = await getNonce(address);
    
    // Encode transfer function call
    const txData = contract.methods.transfer(
      params.toAddress,
      params.amount,
      params.toBankCode,
      params.description
    ).encodeABI()
    
    const txObject = buildTransaction(txCount, params.contractAddress, valueInEther, txData)
    sendTransactionAndProcessIncommingTx(txObject, privKey, t1, fileNameResponse, numberOfTransactions)
  } catch (error) {
    // Error handling with fallback
    console.error(`❌ Error in publishInterbankTransferTransaction: ${error.message}`);
    const params = await getContractParameters();
    const privKeyHex = privKey.toString('hex');
    const privKeyWithPrefix = privKeyHex.startsWith('0x') ? privKeyHex : '0x' + privKeyHex;
    const senderAddress = web3.eth.accounts.privateKeyToAccount(privKeyWithPrefix);
    const address = senderAddress.address;
    
    // Fallback: reset nonce cache and try again
    resetNonce(address);
    try {
      const txCount = await getNonce(address);
      const txData = contract.methods.transfer(
        params.toAddress,
        params.amount,
        params.toBankCode,
        params.description
      ).encodeABI()
      const txObject = buildTransaction(txCount, params.contractAddress, valueInEther, txData)
      sendTransactionAndProcessIncommingTx(txObject, privKey, t1, fileNameResponse, numberOfTransactions)
    } catch (retryError) {
      // Final fallback to nonce 0
      console.error(`❌ Final fallback for ${address.substring(0, 10)}...: ${retryError.message}`);
      const txData = contract.methods.transfer(
        params.toAddress,
        params.amount,
        params.toBankCode,
        params.description
      ).encodeABI()
      const txObject = buildTransaction(0, params.contractAddress, valueInEther, txData)
      sendTransactionAndProcessIncommingTx(txObject, privKey, t1, fileNameResponse, numberOfTransactions)
    }
  }
}

const execInterbankTransferTest = async() => {
  await getContractParameters()
  test(fileNameStimulus, publishInterbankTransferTransaction)
}

module.exports = {execInterbankTransferTest}

