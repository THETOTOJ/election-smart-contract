import { Contract } from 'ethers';

export interface Election {
  id: bigint;
  title: string;
  description: string;
  startTime: bigint;
  endTime: bigint;
  finalized: boolean;
  isRunoff: boolean;
  parentElectionId: bigint;
  runoffElectionId: bigint;
  requiresRunoff: boolean;
}

export interface Candidate {
  id: bigint;
  name: string;
  voteCount: bigint;
  advancedToRunoff: boolean;
}

export interface ElectionResults {
  candidateIds: bigint[];
  candidateNames: string[];
  voteCounts: bigint[];
  advancedToRunoff: boolean[];
}

export interface VotingContextType {
  account: string | null;
  contract: Contract | null;
  isRegistered: boolean;
  hasVoted: boolean;
  election: Election | null;
  results: ElectionResults | null;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  registerToVote: () => Promise<void>;
  castVote: (candidateId: bigint) => Promise<void>;
  refreshData: () => Promise<void>;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { 
        method: string; 
        params?: unknown[] 
      }) => Promise<unknown>;
      isMetaMask?: boolean;
      selectedAddress?: string;
      networkVersion?: string;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}