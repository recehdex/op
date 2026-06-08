const { ethers } = require('ethers');

const CONFIG = {
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    // Token addresses
    USDT: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB di opBNB
    RECEH: "0x82b10a36c36e46a8555c54627c3f6d0215c34183",
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    gasLimit: 200000, // Gas limit besar untuk aman
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const ROUTER_ABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory)",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns ()"
];

async function forceSellAllReceh() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error('❌ Set PRIVATE_KEY environment variable!');
        process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const account = wallet.address;
    
    console.log(`\n🚀 FORCE SELL ALL RECEH`);
    console.log(`📱 Wallet: ${account}`);
    
    // Check balance BNB untuk gas
    const bnbBalance = await provider.getBalance(account);
    console.log(`⛽ BNB Balance: ${ethers.utils.formatEther(bnbBalance)} BNB (untuk gas)`);
    
    if (bnbBalance.lt(ethers.utils.parseEther("0.000015"))) {
        console.log(`❌ BNB tidak cukup untuk gas! Minimal 0.000015 BNB`);
        process.exit(1);
    }
    
    // Check balance RECEH
    const recehToken = new ethers.Contract(CONFIG.RECEH, ERC20_ABI, wallet);
    const recehBalance = await recehToken.balanceOf(account);
    const recehAmount = ethers.utils.formatEther(recehBalance);
    
    console.log(`💰 RECEH Balance: ${recehAmount} RECEH`);
    
    if (recehBalance.isZero()) {
        console.log(`✅ Saldo RECEH sudah 0, tidak perlu menjual!`);
        process.exit(0);
    }
    
    // Get token info
    const decimals = await recehToken.decimals();
    const symbol = await recehToken.symbol();
    console.log(`📊 Token: ${symbol} (${decimals} decimals)`);
    
    // APPROVE dulu
    console.log(`\n📝 Approving RECEH ke router...`);
    const approveTx = await recehToken.approve(CONFIG.router, ethers.constants.MaxUint256, {
        gasLimit: 100000
    });
    await approveTx.wait();
    console.log(`✅ Approve success: ${approveTx.hash}`);
    
    // Execute swap - JUAL SEMUA
    console.log(`\n🔄 Menjual ${recehAmount} RECEH...`);
    
    const router = new ethers.Contract(CONFIG.router, ROUTER_ABI, wallet);
    const path = [CONFIG.RECEH, CONFIG.USDT];
    
    // Set amountOutMin = 1 (terkecil possible) - GAK PEDULI SLIPPAGE
    const amountOutMin = ethers.BigNumber.from("1");
    
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 menit
    
    try {
        // Method 1: Coba dengan swap biasa
        const tx = await router.swapExactTokensForTokens(
            recehBalance,
            amountOutMin,  // Minimal output 1 wei - GAK PEDULI
            path,
            account,
            deadline,
            {
                gasLimit: CONFIG.gasLimit,
                gasPrice: await provider.getGasPrice()
            }
        );
        
        console.log(`📤 Transaction sent: ${tx.hash}`);
        console.log(`⏳ Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        console.log(`✅ SUCCESS! Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`🔗 Explorer: https://opbnbscan.com/tx/${tx.hash}`);
        
        // Cek balance setelah swap
        const newBalance = await recehToken.balanceOf(account);
        console.log(`\n💰 Sisa RECEH: ${ethers.utils.formatEther(newBalance)} RECEH`);
        
        if (newBalance.isZero()) {
            console.log(`🎉 SEMUA RECEH BERHASIL DIJUAL!`);
        } else {
            console.log(`⚠️ Masih ada sisa: ${ethers.utils.formatEther(newBalance)} RECEH`);
        }
        
    } catch (error) {
        console.log(`\n❌ Swap gagal: ${error.message}`);
        
        // Method 2: Coba dengan fee-on-transfer version
        console.log(`\n🔄 Mencoba method alternative (supporting fee on transfer)...`);
        try {
            const router2 = new ethers.Contract(CONFIG.router, ROUTER_ABI, wallet);
            const tx2 = await router2.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                recehBalance,
                amountOutMin,
                path,
                account,
                deadline,
                {
                    gasLimit: CONFIG.gasLimit + 100000,
                    gasPrice: await provider.getGasPrice()
                }
            );
            
            console.log(`📤 Transaction sent: ${tx2.hash}`);
            const receipt2 = await tx2.wait();
            console.log(`✅ SUCCESS! Transaction confirmed`);
            
        } catch (error2) {
            console.log(`❌ Method kedua juga gagal: ${error2.message}`);
            console.log(`\n💡 Saran manual:`);
            console.log(`1. Cek apakah pair RECEH/${CONFIG.USDT} ada di DEX`);
            console.log(`2. Cek apakah router address benar: ${CONFIG.router}`);
            console.log(`3. Coba gunakan UI DEX langsung di browser`);
        }
    }
}

// Eksekusi
forceSellAllReceh().catch(console.error);
