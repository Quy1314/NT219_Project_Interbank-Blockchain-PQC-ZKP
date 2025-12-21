const helper = {}
const readline = require('readline');
const {sendTransaction} = require('../pantheon_utils/web3Operations')
const {append} = require('./logs')
const {STORE_DATA} =require('../keys')
const { web3 } = require('../pantheon_utils/web3')
let count = 0
let failed = 0

// Nonce cache for better performance
const nonceCache = new Map();
const NONCE_RESET_THRESHOLD = 10; // Reset if nonce is more than 10 ahead

helper.reproduce = (times,data) => {
    let customData = ""    
    for(let i = 0; i<times; i++){
        customData = customData + data        
    }
    return customData
}

helper.verify = (outgoing,incoming) =>{
    const match = outgoing === incoming
    if(match){
        console.log("Outgoing and stored data matches")
    }else{
        console.log("Data do not match")
    }
}

helper.askQuestion = async(query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    }); 

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

helper.createRandomString = (strLength) =>{
    strLength = typeof(strLength) === 'number' && strLength >0 ? strLength :false
    if(strLength){
        //Define  all the possible characters that could  go into a string
        const possibleCharacters = 'abcdef0123456789'

        //Start the final string
        let str = ''

        for(let i =1; i<= strLength; i++){
            //Get the random charachter from the possibleCharacters string
            const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random()*
            possibleCharacters.length))
            //Append this character to the final string
            str += randomCharacter
        }
        return str
    }else{
        return false
    }
}

helper.generateKeys = i => {
    // Try to load pre-funded accounts first
    const { loadFundedAccounts } = require('../load-funded-accounts');
    const fundedAccounts = loadFundedAccounts();
    
    if (fundedAccounts && fundedAccounts.length >= i) {
        // Use pre-funded accounts - distribute evenly to avoid nonce congestion
        console.log(`✅ Using ${i} pre-funded accounts (total available: ${fundedAccounts.length})`);
        // Use round-robin distribution instead of random shuffle for better nonce distribution
        const selectedAccounts = [];
        const step = Math.floor(fundedAccounts.length / i);
        for (let k = 0; k < i; k++) {
            const idx = (k * step) % fundedAccounts.length;
            selectedAccounts.push(fundedAccounts[idx]);
        }
        return selectedAccounts;
    }
    
    // Fallback to random generation
    if (fundedAccounts && fundedAccounts.length > 0) {
        console.log(`⚠️  Only ${fundedAccounts.length} pre-funded accounts available, need ${i}. Using mix of funded and random.`);
        const privateKeys = [...fundedAccounts];
        // Fill remaining with random
        for (let k = fundedAccounts.length; k < i; k++) {
            let randomHexKey = helper.createRandomString(64);
            const bufferRandomKey = Buffer.from(randomHexKey, 'hex');
            privateKeys.push(bufferRandomKey);
        }
        return privateKeys;
    }
    
    // No funded accounts, generate random
    console.log(`⚠️  No pre-funded accounts found. Generating ${i} random accounts.`);
    console.log(`⚠️  WARNING: Random accounts may not have funds. Run prepare-benchmark.sh first!`);
    const privateKeys = [];
    for (let k = 1; k <= i; k++) {
        let randomHexKey = helper.createRandomString(64);
        const bufferRandomKey = Buffer.from(randomHexKey, 'hex');
        privateKeys.push(bufferRandomKey);
    }
    return privateKeys;
}

helper.verifyDesiredRate = (desiredRateTx) => {
    desiredRateTx = parseInt(desiredRateTx)
    if(desiredRateTx && desiredRateTx>0 && isFinite(desiredRateTx) ){
        return desiredRateTx //achieves the desired tx rate per second
    }else {
        console.log("invalid rate transaction")
        process.exit()
    }
}

helper.verifyTestime = testTime => {
    testTime = parseFloat(testTime)
    if(testTime && testTime>0 && isFinite(testTime)) {
        return testTime
    }

    console.log("invalid testTime")
    process.exit()
}

helper.verifyAmountData = amountData => {
    amountData =  parseInt(amountData)
    if(amountData>=0 && isFinite(amountData)){
        return amountData
    }

    console.log("invalid data to add on each transaction")
    process.exit()
}

helper.verifyNumberOfContainers  = numerOfContainers => {
    numerOfContainers = parseInt(numerOfContainers)
    if(numerOfContainers>0 && isFinite(numerOfContainers)){
        return numerOfContainers
    }

    console.log("invalid specified number of containers")
    process.exit()
}

helper.sendTransactionAndProcessIncommingTx = async (txObject,privKey,t1,fileNameResponse,numberOfTransactions) => {
    let txTimeResponse
    try{
        await sendTransaction(txObject,privKey)//const receipt = await sendTransaction(txObject,privKey)//only awaiting here for pantheon response
        txTimeResponse = (Date.now() - t1)
        if(STORE_DATA=="TRUE"){
        //append(`${fileNameResponse}`,`${txTimeResponse.toString()},${(numberOfTransactions-count).toString()}`) //sending without awaitng
        append(`${fileNameResponse}`,`${txTimeResponse.toString()},${(count+1).toString()}`) //sending without awaitng
        }
        count++
        //console.log(`Transaction N° ${i} Stored on block `,receipt.blockNumber,"...")  on block `,receipt.blockNumber,"...")        
    }catch(e){
        failed++
        txTimeResponse = (Date.now() - t1)
        //console.log(`Error with transaction N° ${count+failed} => ${e.message}\n this error occurred in privateKey: ${privKey}`)
        if(STORE_DATA=="TRUE"){
            append(`${fileNameResponse}`,`${txTimeResponse.toString()},${(count).toString()}`) //sending without awaitng
        }
    }

    if((count+failed)===numberOfTransactions){
        helper.showResponseResults(failed,txTimeResponse/1000,numberOfTransactions)
        console.log("All done!!")
    }
}

helper.showResponseResults = (failed,delta,numberOfTransactions) => {
    console.log("\n************RESPONSE STATISTICS***************")  
    console.log("N° processed Tx by Pantheon: ",numberOfTransactions-failed)
    console.log(`N° no processed txs: ${failed}`)
    console.log(`response time (s):  ${delta}` )
    console.log(`Effectiveness(%): ${(numberOfTransactions-failed)/numberOfTransactions*100}%`)  
    const rate = numberOfTransactions/(delta)
    console.log("Average responsiveness rate: ",rate, "tx/s")
}

// Get nonce for an address with caching and auto-reset
helper.getNonce = async (address) => {
    if (nonceCache.has(address)) {
        // Use cached nonce and increment
        const cachedNonce = nonceCache.get(address);
        const newNonce = cachedNonce + 1;
        nonceCache.set(address, newNonce);
        
        // Safety check: verify nonce is not too far ahead
        try {
            const blockchainNonce = await web3.eth.getTransactionCount(address, 'pending');
            if (newNonce > blockchainNonce + NONCE_RESET_THRESHOLD) {
                // Reset if too far ahead
                console.warn(`⚠️  Nonce too far ahead for ${address.substring(0, 10)}... Resetting from ${newNonce} to ${blockchainNonce}`);
                nonceCache.set(address, blockchainNonce);
                return blockchainNonce;
            }
        } catch (error) {
            // If we can't check, use cached value anyway
            console.warn(`⚠️  Could not verify nonce for ${address.substring(0, 10)}...: ${error.message}`);
        }
        
        return newNonce;
    } else {
        // First time: get from blockchain
        try {
            const txCount = await web3.eth.getTransactionCount(address, 'pending');
            nonceCache.set(address, txCount);
            return txCount;
        } catch (error) {
            console.error(`❌ Error getting nonce for ${address.substring(0, 10)}...: ${error.message}`);
            // Fallback to 0
            nonceCache.set(address, 0);
            return 0;
        }
    }
}

// Reset nonce cache for an address (useful on errors)
helper.resetNonce = (address) => {
    nonceCache.delete(address);
}

module.exports = helper