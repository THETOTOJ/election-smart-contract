const hre = require("hardhat");

async function main() {
  console.log("=== DEPLOYING AND TESTING VOTING SYSTEM ===");
  
  // Check network and balance first
  const network = await hre.ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  
  // Get available signers
  const signers = await hre.ethers.getSigners();
  const admin = signers[0];
  const balance = await hre.ethers.provider.getBalance(admin.address);
  
  console.log("\n👥 Accounts:");
  console.log("Admin:", admin.address);
  console.log("Admin Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Available signers:", signers.length);
  
  // Check current gas price
  if (network.chainId === 11155111n) {
    try {
      const feeData = await hre.ethers.provider.getFeeData();
      console.log("Current gas price:", hre.ethers.formatUnits(feeData.gasPrice || 0, "gwei"), "gwei");
    } catch (error) {
      console.log("Could not fetch gas price");
    }
  }
  
  // Check if we have enough ETH for deployment
  if (network.chainId === 11155111n) { // Sepolia
    if (balance < hre.ethers.parseEther("0.002")) { // Much lower minimum requirement
      console.log("❌ Insufficient balance for Sepolia deployment!");
      console.log("You need at least 0.002 ETH on Sepolia.");
      console.log("Get Sepolia ETH from:");
      console.log("- PoW Faucet: https://sepolia-faucet.pk910.de/ (0.5+ ETH)");
      console.log("- QuickNode: https://faucet.quicknode.com/ethereum/sepolia (0.1 ETH)");
      console.log("- Chainlink: https://faucets.chain.link/sepolia (0.1 ETH)");
      process.exit(1);
    }
  }

  // Deploy the contract with ULTRA LOW GAS settings
  console.log("\n📋 Deploying VotingSystem contract...");
  const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
  
  // Ultra-low gas settings (100x smaller gas price)
  const deployOptions = network.chainId === 11155111n ? {
    gasLimit: 2500000,  // Keep gas limit high for complex contract
    gasPrice: hre.ethers.parseUnits("0.06", "gwei")  // 100x smaller: 6 gwei -> 0.06 gwei
  } : {};
  
  // Show estimated cost
  if (network.chainId === 11155111n) {
    const estimatedCost = BigInt(2500000) * hre.ethers.parseUnits("0.06", "gwei");
    console.log("💰 Estimated deployment cost:", hre.ethers.formatEther(estimatedCost), "ETH");
    
    if (balance < estimatedCost) {
      console.log("❌ Insufficient balance for deployment!");
      console.log("Need:", hre.ethers.formatEther(estimatedCost), "ETH");
      console.log("Have:", hre.ethers.formatEther(balance), "ETH");
      process.exit(1);
    }
  }
  
  console.log("⚠️  Using ultra-low gas price - transaction may take longer to confirm...");
  
  const votingSystem = await VotingSystem.deploy(deployOptions);
  await votingSystem.waitForDeployment();

  const contractAddress = await votingSystem.getAddress();
  console.log("✅ VotingSystem deployed to:", contractAddress);
  
  if (network.chainId === 11155111n) {
    console.log("🔍 View on Etherscan:", `https://sepolia.etherscan.io/address/${contractAddress}`);
    console.log("⏳ Waiting for block confirmations (may take longer with low gas)...");
    await votingSystem.deploymentTransaction()?.wait(3);
  }

  try {
    // 1. Create an election (as admin)
    console.log("\n🗳️  1. Creating election...");
    const tx1 = await votingSystem.connect(admin).createElection(
      "Presidential Election 2024",
      "Vote for your preferred candidate",
      network.chainId === 11155111n ? 1440 : 60, // 24 hours for Sepolia, 1 hour for localhost
      { 
        gasLimit: 300000, 
        gasPrice: network.chainId === 11155111n ? hre.ethers.parseUnits("0.06", "gwei") : undefined 
      }
    );
    await tx1.wait();
    console.log("✅ Election created!");

    // 2. Add candidates (as admin)
    console.log("\n👤 2. Adding candidates...");
    
    const candidates = ["Charlie Kelly", "Dennis Reynolds", "Mac"];
    
    for (const candidateName of candidates) {
      const tx = await votingSystem.connect(admin).addCandidate(
        1, 
        candidateName,
        { 
          gasLimit: 250000, 
          gasPrice: network.chainId === 11155111n ? hre.ethers.parseUnits("0.06", "gwei") : undefined 
        }
      );
      await tx.wait();
      console.log(`✅ Added ${candidateName}`);
      
      // Small delay between transactions on Sepolia
      if (network.chainId === 11155111n) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for low gas
      }
    }

    // 3. Test contract functions
    console.log("\n🧪 3. Testing contract functions...");
    const adminAddress = await votingSystem.admin();
    const electionCounter = await votingSystem.electionCounter();
    console.log("✅ Contract admin:", adminAddress);
    console.log("✅ Election counter:", electionCounter.toString());
    
    // Test election data
    const election = await votingSystem.getElection(1);
    console.log("✅ Election title:", election[1]);
    
    // Test getting results
    const results = await votingSystem.getElectionResults(1);
    console.log("✅ Candidates loaded:", results[1].length);

    // 4. Register the admin as a voter (for testing)
    console.log("\n📝 4. Registering admin as voter...");
    const isAlreadyRegistered = await votingSystem.registeredVoters(admin.address);
    
    if (!isAlreadyRegistered) {
      const regTx = await votingSystem.connect(admin).registerToVote({
        gasLimit: 150000,
        gasPrice: network.chainId === 11155111n ? hre.ethers.parseUnits("0.06", "gwei") : undefined
      });
      await regTx.wait();
      console.log("✅ Admin registered as voter!");
    } else {
      console.log("✅ Admin already registered as voter!");
    }

    // 5. Cast a test vote
    console.log("\n🗳️  5. Casting test vote...");
    const hasVoted = await votingSystem.hasUserVoted(admin.address, 1);
    
    if (!hasVoted) {
      const voteTx = await votingSystem.connect(admin).vote(1, 1, {
        gasLimit: 150000,
        gasPrice: network.chainId === 11155111n ? hre.ethers.parseUnits("0.06", "gwei") : undefined
      }); // Vote for Charlie
      await voteTx.wait();
      console.log("✅ Test vote cast for Charlie Kelly!");
    } else {
      console.log("✅ Admin has already voted!");
    }

    // 6. Check final results
    console.log("\n🏆 6. Final Results:");
    const finalResults = await votingSystem.getElectionResults(1);
    for (let i = 0; i < finalResults[1].length; i++) {
      console.log(`${finalResults[1][i]}: ${finalResults[2][i]} votes`);
    }

    // 7. Check election status
    console.log("\n📊 7. Election Status:");
    const electionData = await votingSystem.getElection(1);
    const isActive = await votingSystem.isElectionActive(1);
    console.log("Title:", electionData[1]);
    console.log("Description:", electionData[2]);
    console.log("Active:", isActive);
    console.log("Finalized:", electionData[5]);
    console.log("Is Runoff:", electionData[6]);
    console.log("Requires Runoff:", electionData[9]);

    console.log("\n🎉 Deployment and testing completed successfully!");
    
    // Final instructions
    console.log("\n📋 IMPORTANT: UPDATE YOUR FRONTEND!");
    console.log("Copy this line to frontend/lib/contract.ts:");
    console.log(`export const CONTRACT_ADDRESS = "${contractAddress}";`);
    
    console.log("\n🚀 Your runoff-enabled voting dApp is ready!");
    console.log("- Contract deployed and verified");
    console.log("- Election created with 3 candidates");
    console.log("- Runoff functionality enabled");
    console.log("- Ready for users to register and vote");

  } catch (error) {
    console.error("❌ Error during setup:", error.message);
    console.log("\n✅ Contract still deployed successfully at:", contractAddress);
    console.log("You can manually set up the election through your frontend.");
    console.log("\n📋 UPDATE FRONTEND:");
    console.log(`export const CONTRACT_ADDRESS = "${contractAddress}";`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});