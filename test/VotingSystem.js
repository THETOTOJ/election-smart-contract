const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingSystem", function () {
  let VotingSystem;
  let votingSystem;
  let admin;
  let voter1;
  let voter2;

  beforeEach(async function () {
    VotingSystem = await ethers.getContractFactory("VotingSystem");
    [admin, voter1, voter2] = await ethers.getSigners();
    votingSystem = await VotingSystem.deploy();
    await votingSystem.waitForDeployment();
  });

  describe("Election Creation", function () {
    it("Should allow admin to create election", async function () {
      await votingSystem.connect(admin).createElection(
        "Test Election",
        "Test Description",
        60
      );
      
      const election = await votingSystem.getElection(1);
      expect(election.title).to.equal("Test Election");
    });

    it("Should not allow non-admin to create election", async function () {
      await expect(
        votingSystem.connect(voter1).createElection(
          "Test Election",
          "Test Description",
          60
        )
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("Voting Process", function () {
    beforeEach(async function () {
      // Create election and add candidates
      await votingSystem.connect(admin).createElection("Test Election", "Test", 60);
      await votingSystem.connect(admin).addCandidate(1, "Alice");
      await votingSystem.connect(admin).addCandidate(1, "Bob");
      
      // Register voters
      await votingSystem.connect(voter1).registerToVote();
      await votingSystem.connect(voter2).registerToVote();
    });

    it("Should allow registered voter to vote", async function () {
      await votingSystem.connect(voter1).vote(1, 1);
      
      const hasVoted = await votingSystem.hasUserVoted(voter1.address, 1);
      expect(hasVoted).to.be.true;
    });

    it("Should not allow double voting", async function () {
      await votingSystem.connect(voter1).vote(1, 1);
      
      await expect(
        votingSystem.connect(voter1).vote(1, 2)
      ).to.be.revertedWith("You have already voted in this election");
    });

    it("Should update vote count correctly", async function () {
      await votingSystem.connect(voter1).vote(1, 1);
      await votingSystem.connect(voter2).vote(1, 1);
      
      const candidate = await votingSystem.getCandidate(1, 1);
      expect(candidate.voteCount).to.equal(2);
    });
  });
});