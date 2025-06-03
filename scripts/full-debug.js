const hre = require("hardhat");

async function main() {
  const contractAddress = "0xAb33b84f0E68DC31C57cCB78E430924C1C5a6037";
  
  console.log("🔍 Debugging deployed contract...");
  console.log("Contract Address:", contractAddress);
  
  try {
    // Connect to deployed contract
    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
    const votingSystem = VotingSystem.attach(contractAddress);
    
    // Check basic contract state
    console.log("\n📊 Contract State:");
    const admin = await votingSystem.admin();
    const electionCounter = await votingSystem.electionCounter();
    
    console.log("Admin:", admin);
    console.log("Election Counter:", electionCounter.toString());
    
    // Check if we're the admin
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Is Deployer Admin?", admin.toLowerCase() === deployer.address.toLowerCase());
    
    // Try to create an election first
    if (electionCounter === 0n) {
      console.log("\n🗳️ No elections found. Creating one...");
      try {
        const tx1 = await votingSystem.createElection(
          "Test Election",
          "Testing the voting system",
          60,
          { gasLimit: 300000, gasPrice: hre.ethers.parseUnits("10", "gwei") }
        );
        await tx1.wait();
        console.log("✅ Election created successfully!");
        
        // Check election counter again
        const newCounter = await votingSystem.electionCounter();
        console.log("New Election Counter:", newCounter.toString());
        
      } catch (electionError) {
        console.error("❌ Failed to create election:", electionError.message);
        return;
      }
    }
    
    // Now try to add a candidate
    console.log("\n👤 Testing candidate addition...");
    try {
      const tx2 = await votingSystem.addCandidate(
        1, // Election ID
        "Test Candidate",
        "https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Test",
        { gasLimit: 300000, gasPrice: hre.ethers.parseUnits("10", "gwei") }
      );
      await tx2.wait();
      console.log("✅ Candidate added successfully!");
      
    } catch (candidateError) {
      console.error("❌ Failed to add candidate:", candidateError.message);
      
      // Try to get more specific error info
      try {
        await votingSystem.addCandidate.staticCall(
          1,
          "Test Candidate", 
          "https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Test"
        );
      } catch (staticError) {
        console.error("Static call error:", staticError.message);
      }
    }
    
  } catch (error) {
    console.error("❌ Debug error:", error.message);
  }
}

main().catch(console.error);