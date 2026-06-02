const { ethers } = require('ethers');

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider("https://opbnb-mainnet-rpc.bnbchain.org");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const RECEH = "0x47f63E5654db977C8Bec9Bd11928c4d517af7655";
const USDT = "0x4200000000000000000000000000000000000006";
const ROUTER = "0xa07a8da9C0288c18D5fd85369D8d5b77eE83c91c";

async function sell() {
    const receh = new ethers.Contract(RECEH, [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address, uint256) returns (bool)"
    ], wallet);
    
    const balance = await receh.balanceOf(wallet.address);
    console.log(`Balance: ${ethers.utils.formatEther(balance)} RECEH`);
    
    if (balance.gt(0)) {
        await receh.approve(ROUTER, ethers.constants.MaxUint256);
        const router = new ethers.Contract(ROUTER, [
            "function swapExactTokensForTokens(uint, uint, address[], address, uint) returns (uint[])"
        ], wallet);
        
        const tx = await router.swapExactTokensForTokens(
            balance, 
            1, // minimal output 1 wei - GAK PEDULI
            [RECEH, USDT], 
            wallet.address, 
            Math.floor(Date.now()/1000)+600,
            { gasLimit: 500000 }
        );
        await tx.wait();
        console.log("✅ SOLD! TX:", tx.hash);
    }
}

sell();
