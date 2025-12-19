const Web3 = require('web3')
const ethTx = require('ethereumjs-tx')
const https = require('https')
const {RPC_URL} =  require('../keys')

// Support HTTPS with self-signed certificates
let provider
if (RPC_URL.startsWith('https://')) {
  // For HTTPS, ignore self-signed certificate errors
  const httpsAgent = new https.Agent({
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
  })
  provider = new Web3.providers.HttpProvider(RPC_URL, { agent: httpsAgent })
} else {
  provider = new Web3.providers.HttpProvider(RPC_URL)
}

// web3 initialization - must point to the HTTP/HTTPS JSON-RPC endpoint
const web3 = new Web3(provider)

module.exports = {web3,ethTx}