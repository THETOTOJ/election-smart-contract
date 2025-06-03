export const CONTRACT_ADDRESS = "0x14e5B7D088d10A65d9751469C0B635dBA1d9cbA2";

export const VOTING_ABI = [
  "function admin() view returns (address)",
  "function electionCounter() view returns (uint256)",
  "function registeredVoters(address) view returns (bool)",
  "function hasUserVoted(address, uint256) view returns (bool)",
  "function isElectionActive(uint256) view returns (bool)",
  "function getElection(uint256) view returns (uint256, string, string, uint256, uint256, bool, bool, uint256, uint256, bool)",
  "function getElectionResults(uint256) view returns (uint256[], string[], uint256[], bool[])",
  "function getElectionCandidates(uint256) view returns (uint256[])",
  "function getCandidate(uint256, uint256) view returns (uint256, string, uint256, bool)",
  "function getWinner(uint256) view returns (bool, uint256, string, uint256, bool)",
  "function registerToVote()",
  "function vote(uint256, uint256)",
  "function createElection(string, string, uint256)",
  "function addCandidate(uint256, string)",
  "function finalizeElection(uint256)",
  "event VoterRegistered(address indexed voter)",
  "event VoteCast(address indexed voter, uint256 indexed electionId, uint256 indexed candidateId)",
  "event ElectionCreated(uint256 indexed electionId, string title, uint256 startTime, uint256 endTime)",
  "event RunoffRequired(uint256 indexed originalElectionId, uint256 indexed runoffElectionId)"
];

export const ELECTION_ID = BigInt(1);
export const SEPOLIA_CHAIN_ID = 11155111;