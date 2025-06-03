// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract VotingSystem {
    // Struct to represent a candidate
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
        bool exists;
        bool advancedToRunoff;
    }
    
    // Struct to represent an election
    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool exists;
        bool finalized;
        bool isRunoff;
        uint256 parentElectionId;
        uint256 runoffElectionId;
        bool requiresRunoff;
    }
    
    // State variables
    address public admin;
    uint256 public electionCounter;
    uint256 public candidateCounter;
    
    // Mappings
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => uint256[]) public electionCandidates;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    mapping(address => bool) public registeredVoters;
    
    // Events
    event ElectionCreated(uint256 indexed electionId, string title, uint256 startTime, uint256 endTime);
    event RunoffRequired(uint256 indexed originalElectionId, uint256 indexed runoffElectionId);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed electionId, uint256 indexed candidateId);
    event ElectionFinalized(uint256 indexed electionId, bool runoffRequired);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyRegisteredVoter() {
        require(registeredVoters[msg.sender], "You must be a registered voter");
        _;
    }
    
    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }
    
    modifier electionActive(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        require(block.timestamp >= elections[_electionId].startTime, "Election has not started yet");
        require(block.timestamp <= elections[_electionId].endTime, "Election has ended");
        require(!elections[_electionId].finalized, "Election has been finalized");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        electionCounter = 0;
        candidateCounter = 0;
    }
    
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _durationInMinutes
    ) public onlyAdmin {
        electionCounter++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (_durationInMinutes * 60);
        
        elections[electionCounter] = Election({
            id: electionCounter,
            title: _title,
            description: _description,
            startTime: startTime,
            endTime: endTime,
            exists: true,
            finalized: false,
            isRunoff: false,
            parentElectionId: 0,
            runoffElectionId: 0,
            requiresRunoff: false
        });
        
        emit ElectionCreated(electionCounter, _title, startTime, endTime);
    }
    
    function addCandidate(
        uint256 _electionId,
        string memory _name
    ) public onlyAdmin electionExists(_electionId) {
        require(!elections[_electionId].finalized, "Cannot add candidates to finalized election");
        
        candidateCounter++;
        
        candidates[_electionId][candidateCounter] = Candidate({
            id: candidateCounter,
            name: _name,
            voteCount: 0,
            exists: true,
            advancedToRunoff: false
        });
        
        electionCandidates[_electionId].push(candidateCounter);
        
        emit CandidateAdded(_electionId, candidateCounter, _name);
    }
    
    function finalizeElection(uint256 _electionId) public onlyAdmin electionExists(_electionId) {
        require(block.timestamp > elections[_electionId].endTime, "Election is still active");
        require(!elections[_electionId].finalized, "Election already finalized");
        
        elections[_electionId].finalized = true;
        
        bool runoffRequired = false;
        if (!elections[_electionId].isRunoff) {
            runoffRequired = _checkAndCreateRunoff(_electionId);
        }
        
        elections[_electionId].requiresRunoff = runoffRequired;
        emit ElectionFinalized(_electionId, runoffRequired);
    }
    
    // Split the runoff logic into smaller functions to avoid stack too deep
    function _checkAndCreateRunoff(uint256 _electionId) internal returns (bool) {
    uint256[] memory candidateIds = electionCandidates[_electionId];
    require(candidateIds.length >= 2, "Need at least 2 candidates for runoff");
    
    // Get vote statistics - ignore highestVotes since we don't use it
    (, uint256[] memory topCandidates, uint256 topCount) = _getTopCandidates(_electionId);
    
    // Create runoff if there's a tie
    if (topCount > 1) {
        return _createRunoffElection(_electionId, topCandidates, topCount);
    }
    
    return false;
    }
    
    function _getTopCandidates(uint256 _electionId) internal view returns (
        uint256 highestVotes,
        uint256[] memory topCandidates,
        uint256 topCount
    ) {
        uint256[] memory candidateIds = electionCandidates[_electionId];
        topCandidates = new uint256[](candidateIds.length);
        
        // Find highest vote count
        for (uint256 i = 0; i < candidateIds.length; i++) {
            uint256 voteCount = candidates[_electionId][candidateIds[i]].voteCount;
            if (voteCount > highestVotes) {
                highestVotes = voteCount;
            }
        }
        
        // Count candidates with highest votes
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[_electionId][candidateIds[i]].voteCount == highestVotes) {
                topCandidates[topCount] = candidateIds[i];
                topCount++;
            }
        }
    }
    
    function _createRunoffElection(
        uint256 _parentElectionId,
        uint256[] memory _topCandidates,
        uint256 _candidateCount
    ) internal returns (bool) {
        electionCounter++;
        uint256 runoffId = electionCounter;
        
        Election memory parentElection = elections[_parentElectionId];
        uint256 runoffDuration = parentElection.endTime - parentElection.startTime;
        uint256 runoffStartTime = block.timestamp + 300; // 5 minute break
        
        elections[runoffId] = Election({
            id: runoffId,
            title: string(abi.encodePacked(parentElection.title, " - Runoff")),
            description: string(abi.encodePacked("Runoff election for: ", parentElection.description)),
            startTime: runoffStartTime,
            endTime: runoffStartTime + runoffDuration,
            exists: true,
            finalized: false,
            isRunoff: true,
            parentElectionId: _parentElectionId,
            runoffElectionId: 0,
            requiresRunoff: false
        });
        
        elections[_parentElectionId].runoffElectionId = runoffId;
        
        // Add candidates to runoff
        _addRunoffCandidates(runoffId, _parentElectionId, _topCandidates, _candidateCount);
        
        emit RunoffRequired(_parentElectionId, runoffId);
        emit ElectionCreated(runoffId, elections[runoffId].title, runoffStartTime, runoffStartTime + runoffDuration);
        
        return true;
    }
    
    function _addRunoffCandidates(
        uint256 _runoffId,
        uint256 _parentElectionId,
        uint256[] memory _topCandidates,
        uint256 _candidateCount
    ) internal {
        for (uint256 i = 0; i < _candidateCount; i++) {
            candidateCounter++;
            
            candidates[_runoffId][candidateCounter] = Candidate({
                id: candidateCounter,
                name: candidates[_parentElectionId][_topCandidates[i]].name,
                voteCount: 0,
                exists: true,
                advancedToRunoff: true
            });
            
            electionCandidates[_runoffId].push(candidateCounter);
            candidates[_parentElectionId][_topCandidates[i]].advancedToRunoff = true;
        }
    }
    
    function registerToVote() public {
        require(!registeredVoters[msg.sender], "You are already registered");
        registeredVoters[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }
    
    function vote(
        uint256 _electionId,
        uint256 _candidateId
    ) public onlyRegisteredVoter electionActive(_electionId) {
        require(!hasVoted[msg.sender][_electionId], "You have already voted in this election");
        require(candidates[_electionId][_candidateId].exists, "Candidate does not exist");
        
        hasVoted[msg.sender][_electionId] = true;
        candidates[_electionId][_candidateId].voteCount++;
        
        emit VoteCast(msg.sender, _electionId, _candidateId);
    }
    
    function getElection(uint256 _electionId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        bool finalized,
        bool isRunoff,
        uint256 parentElectionId,
        uint256 runoffElectionId,
        bool requiresRunoff
    ) {
        require(elections[_electionId].exists, "Election does not exist");
        Election memory election = elections[_electionId];
        return (
            election.id,
            election.title,
            election.description,
            election.startTime,
            election.endTime,
            election.finalized,
            election.isRunoff,
            election.parentElectionId,
            election.runoffElectionId,
            election.requiresRunoff
        );
    }
    
    function getCandidate(uint256 _electionId, uint256 _candidateId) public view returns (
        uint256 id,
        string memory name,
        uint256 voteCount,
        bool advancedToRunoff
    ) {
        require(candidates[_electionId][_candidateId].exists, "Candidate does not exist");
        Candidate memory candidate = candidates[_electionId][_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount, candidate.advancedToRunoff);
    }
    
    function getElectionCandidates(uint256 _electionId) public view electionExists(_electionId) returns (uint256[] memory) {
        return electionCandidates[_electionId];
    }
    
    function getElectionResults(uint256 _electionId) public view electionExists(_electionId) returns (
        uint256[] memory candidateIds,
        string[] memory candidateNames,
        uint256[] memory voteCounts,
        bool[] memory advancedToRunoff
    ) {
        uint256[] memory candidateIdList = electionCandidates[_electionId];
        uint256 candidateCount = candidateIdList.length;
        
        candidateIds = new uint256[](candidateCount);
        candidateNames = new string[](candidateCount);
        voteCounts = new uint256[](candidateCount);
        advancedToRunoff = new bool[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            uint256 candidateId = candidateIdList[i];
            Candidate storage candidate = candidates[_electionId][candidateId];
            
            candidateIds[i] = candidate.id;
            candidateNames[i] = candidate.name;
            voteCounts[i] = candidate.voteCount;
            advancedToRunoff[i] = candidate.advancedToRunoff;
        }
    }
    
    function isElectionActive(uint256 _electionId) public view electionExists(_electionId) returns (bool) {
        Election memory election = elections[_electionId];
        return (block.timestamp >= election.startTime && 
                block.timestamp <= election.endTime && 
                !election.finalized);
    }
    
    function hasUserVoted(address _voter, uint256 _electionId) public view returns (bool) {
        return hasVoted[_voter][_electionId];
    }
    
    function getWinner(uint256 _electionId) public view electionExists(_electionId) returns (
        bool hasWinner,
        uint256 winnerId,
        string memory winnerName,
        uint256 winnerVotes,
        bool isTied
    ) {
        require(elections[_electionId].finalized, "Election must be finalized");
        
        uint256[] memory candidateIds = electionCandidates[_electionId];
        uint256 highestVotes = 0;
        uint256 winnerId_ = 0;
        string memory winnerName_ = "";
        uint256 tiedCount = 0;
        
        for (uint256 i = 0; i < candidateIds.length; i++) {
            uint256 candidateId = candidateIds[i];
            uint256 voteCount = candidates[_electionId][candidateId].voteCount;
            
            if (voteCount > highestVotes) {
                highestVotes = voteCount;
                winnerId_ = candidateId;
                winnerName_ = candidates[_electionId][candidateId].name;
                tiedCount = 1;
            } else if (voteCount == highestVotes && voteCount > 0) {
                tiedCount++;
            }
        }
        
        return (
            highestVotes > 0,
            winnerId_,
            winnerName_,
            highestVotes,
            tiedCount > 1
        );
    }
}