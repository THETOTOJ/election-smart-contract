"use client";

import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract } from 'ethers';
import { CONTRACT_ADDRESS, VOTING_ABI, ELECTION_ID } from '@/lib/contract';
import { Election, ElectionResults } from '@/lib/types';
import WalletConnection from './WalletConnection';
import ElectionResultsComponent from './ElectionResults';
import CountdownTimer from './CountdownTimer';

export default function VotingInterface() {
  const [account, setAccount] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const ensureCorrectNetwork = async () => {
    if (!window.ethereum) return;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') { // Not Sepolia
        console.log('Switching to Sepolia network...');
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        });
      }
    } catch (switchError: unknown) {
      console.error('Network switch failed:', switchError);
      const errorObj = switchError as { code?: number };
      
      if (errorObj.code === 4902) {
        // Chain doesn't exist, add it
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://sepolia.infura.io/v3/16b9942010754b299b1214c69a5ff82f'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
          setError('Failed to add Sepolia network to MetaMask');
        }
      } else {
        setError('Please switch to Sepolia testnet in MetaMask manually');
      }
    }
  };

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask is not installed');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure correct network
      await ensureCorrectNetwork();
      
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log('Connected to account:', address);
      setAccount(address);

      // Verify contract exists
      console.log('Checking contract at:', CONTRACT_ADDRESS);
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error(`No contract found at address ${CONTRACT_ADDRESS}. Please check the contract address.`);
      }
      console.log('✅ Contract exists');

      // Create contract instance
      const votingContract = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, signer);
      setContract(votingContract);

      // Test basic contract functionality
      try {
        const admin = await votingContract.admin();
        console.log('✅ Contract admin:', admin);
      } catch (contractError) {
        console.error('Contract test failed:', contractError);
        throw new Error('Contract interaction failed. The contract may not be deployed correctly.');
      }

      // Load user and election data
      await loadUserData(votingContract, address);
      await loadElectionData(votingContract);

    } catch (connectError) {
      console.error('Error connecting wallet:', connectError);
      const errorMessage = connectError instanceof Error ? connectError.message : 'Failed to connect wallet';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserData = async (contract: Contract, address: string) => {
    try {
      console.log('🔍 Loading user data for:', address);
      
      // Check registration status
      let isRegistered = false;
      try {
        isRegistered = await contract.registeredVoters(address);
        console.log('✅ Registration status:', isRegistered);
      } catch (registrationError) {
        console.error('❌ Registration check failed:', registrationError);
        throw new Error('Failed to check registration status. Contract may not be working properly.');
      }
      
      setIsRegistered(isRegistered);

      // Check voting status
      let hasVoted = false;
      try {
        hasVoted = await contract.hasUserVoted(address, ELECTION_ID);
        console.log('✅ Voting status:', hasVoted);
      } catch (voteCheckError) {
        console.error('❌ Vote check failed:', voteCheckError);
        // Don't throw here, just log the warning
        console.warn('Could not check voting status, but continuing...');
      }
      
      setHasVoted(hasVoted);
      
    } catch (userDataError) {
      console.error('❌ Error in loadUserData:', userDataError);
      const errorMessage = userDataError instanceof Error ? userDataError.message : 'Failed to load user data';
      setError(errorMessage);
    }
  };

  const loadElectionData = async (contract: Contract) => {
    try {
      console.log('📊 Loading election data...');
      
      // First check if any elections exist
      let electionCounter;
      try {
        electionCounter = await contract.electionCounter();
        console.log('Total elections:', electionCounter.toString());
      } catch (counterError) {
        console.error('Failed to get election count:', counterError);
        throw new Error('Failed to get election count. Contract may not be deployed correctly.');
      }
      
      if (electionCounter === BigInt(0)) {
        setError('No elections found. The contract admin needs to create an election first.');
        return;
      }
      
      // Check if the specific election exists
      if (ELECTION_ID > electionCounter) {
        setError(`Election ${ELECTION_ID} doesn't exist. Only ${electionCounter} elections found.`);
        return;
      }
      
      // Load election data
      console.log(`Loading election ${ELECTION_ID}...`);
      let electionData;
      try {
        electionData = await contract.getElection(ELECTION_ID);
      } catch (electionError) {
        console.error('Failed to load election:', electionError);
        throw new Error(`Failed to load election ${ELECTION_ID}. It may not exist.`);
      }
      
      // Updated election structure with runoff fields
      const election = {
        id: electionData[0],
        title: electionData[1],
        description: electionData[2],
        startTime: electionData[3],
        endTime: electionData[4],
        finalized: electionData[5],
        isRunoff: electionData[6] || false,
        parentElectionId: electionData[7] || BigInt(0),
        runoffElectionId: electionData[8] || BigInt(0),
        requiresRunoff: electionData[9] || false
      };
      
      console.log('✅ Election loaded:', election);
      setElection(election);

      // Load election results
      console.log('Loading election results...');
      let resultsData;
      try {
        resultsData = await contract.getElectionResults(ELECTION_ID);
      } catch (resultsError) {
        console.error('Failed to load results:', resultsError);
        throw new Error('Failed to load election results.');
      }
      
      // Updated results structure with runoff fields
      const results = {
        candidateIds: resultsData[0],
        candidateNames: resultsData[1],
        voteCounts: resultsData[2],
        advancedToRunoff: resultsData[3] || resultsData[0].map(() => false) // Default to false array if not available
      };
      
      console.log('✅ Results loaded:', results);
      setResults(results);
      
      // Clear any previous errors if we got this far
      setError(null);
      
    } catch (electionDataError) {
      console.error('❌ Error loading election data:', electionDataError);
      
      let errorMessage = 'Failed to load election data';
      if (electionDataError instanceof Error) {
        if (electionDataError.message.includes('could not decode result data')) {
          errorMessage = 'Contract method call failed. The contract may not be deployed correctly.';
        } else if (electionDataError.message.includes('Election does not exist')) {
          errorMessage = 'Election not found. Please check if an election has been created.';
        } else {
          errorMessage = electionDataError.message;
        }
      }
      
      setError(errorMessage);
    }
  };

  const registerToVote = async () => {
    if (!contract) {
      setError('Contract not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📝 Registering to vote...');
      
      // Check if already registered first
      if (account) {
        const alreadyRegistered = await contract.registeredVoters(account);
        if (alreadyRegistered) {
          setIsRegistered(true);
          setError(null);
          setIsLoading(false);
          return;
        }
      }

      // Send registration transaction
      const tx = await contract.registerToVote();
      console.log('Registration transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Registration confirmed:', receipt);
      
      setIsRegistered(true);
      setError(null);
      
      // Refresh user data after successful registration
      if (account) {
        await loadUserData(contract, account);
      }
      
    } catch (registrationError) {
      console.error('❌ Registration error:', registrationError);
      const errorMessage = registrationError instanceof Error ? registrationError.message : 'Failed to register to vote';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const castVote = async (candidateId: bigint) => {
    if (!contract) {
      setError('Contract not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🗳️ Casting vote for candidate:', candidateId.toString());
      
      // Send vote transaction
      const tx = await contract.vote(ELECTION_ID, candidateId);
      console.log('Vote transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Vote confirmed:', receipt);

      setHasVoted(true);
      
      // Refresh election data to show updated results
      await loadElectionData(contract);
      
      setError(null);
      
    } catch (voteError) {
      console.error('❌ Voting error:', voteError);
      let errorMessage = 'Failed to cast vote';
      
      if (voteError instanceof Error) {
        if (voteError.message.includes('You have already voted')) {
          errorMessage = 'You have already voted in this election';
          setHasVoted(true);
        } else if (voteError.message.includes('You must be a registered voter')) {
          errorMessage = 'You must register to vote first';
          setIsRegistered(false);
        } else {
          errorMessage = voteError.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    if (contract && account) {
      setIsLoading(true);
      try {
        await loadUserData(contract, account);
        await loadElectionData(contract);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Test contract connection function
  const testContract = async () => {
    if (contract) {
      try {
        setIsLoading(true);
        const admin = await contract.admin();
        const electionCount = await contract.electionCounter();
        
        alert(`Contract is working!\nAdmin: ${admin}\nElections: ${electionCount.toString()}`);
        console.log('✅ Contract test successful');
      } catch (testError) {
        console.error('❌ Contract test failed:', testError);
        const errorMessage = testError instanceof Error ? testError.message : 'Unknown error';
        alert('Contract test failed: ' + errorMessage);
      } finally {
        setIsLoading(false);
      }
    } else {
      alert('No contract connected');
    }
  };

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          }) as string[];
          
          if (accounts.length > 0) {
            await connectWallet();
          }
        } catch (autoConnectError) {
          console.error('Auto-connect failed:', autoConnectError);
        }
      }
    };

    autoConnect();
  }, [connectWallet]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        
        {/* Debug Toggle Button - Fixed Position */}
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-lg ${
              showDebug 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            🔧 {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>

        {/* Collapsible Debug Info Panel */}
        {showDebug && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm mt-16">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-blue-800 mb-2">🔧 Debug Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-blue-700"><span className="font-medium">Contract:</span> {CONTRACT_ADDRESS}</p>
                    <p className="text-blue-700"><span className="font-medium">Network:</span> Sepolia Testnet</p>
                    <p className="text-blue-700"><span className="font-medium">Account:</span> {account || 'Not connected'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700"><span className="font-medium">Registered:</span> {isRegistered ? 'Yes' : 'No'}</p>
                    <p className="text-blue-700"><span className="font-medium">Has Voted:</span> {hasVoted ? 'Yes' : 'No'}</p>
                    <p className="text-blue-700"><span className="font-medium">Contract Connected:</span> {contract ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={testContract}
                  disabled={!contract || isLoading}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  Test Contract
                </button>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-blue-600 hover:text-blue-800 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🗳️ Decentralized Voting System
          </h1>
          <p className="text-gray-600">
            Secure, transparent, and immutable voting on the blockchain
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-red-600 text-xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-red-800 font-semibold">Error</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
              <p className="text-yellow-700">Processing transaction...</p>
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        <WalletConnection
          account={account}
          onConnect={connectWallet}
          isRegistered={isRegistered}
          onRegister={registerToVote}
          isLoading={isLoading}
        />

        {/* Election Information with Countdown */}
        {account && election && (
          <div className="space-y-4">
            {/* Election Details */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">{election.title}</h2>
              <p className="text-gray-600 mb-4">{election.description}</p>
              
              {/* Runoff Information */}
              {election.isRunoff && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <span className="text-orange-600 text-lg mr-2">🔄</span>
                    <div>
                      <h4 className="font-semibold text-orange-800">Runoff Election</h4>
                      <p className="text-sm text-orange-700">This is a runoff between the top candidates from the previous election.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {election.requiresRunoff && election.runoffElectionId > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <span className="text-blue-600 text-lg mr-2">📊</span>
                    <div>
                      <h4 className="font-semibold text-blue-800">Runoff Required</h4>
                      <p className="text-sm text-blue-700">A runoff election has been created due to a tie. Check election #{election.runoffElectionId.toString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Election ID:</span>
                  <p className="text-gray-600">{election.id.toString()}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className={election.finalized ? 'text-red-600' : 'text-green-600'}>
                    {election.finalized ? 'Finalized' : 'Active'}
                  </p>
                </div>
                <div>
                  <button
                    onClick={refreshData}
                    disabled={isLoading}
                    className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    🔄 Refresh Data
                  </button>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <CountdownTimer 
              endTime={election.endTime}
              isActive={!election.finalized}
              isFinalized={election.finalized}
            />
          </div>
        )}

        {/* Voting Interface */}
        {account && isRegistered && (
          <ElectionResultsComponent
            results={results}
            hasVoted={hasVoted}
            onVote={castVote}
            isRegistered={isRegistered}
            isLoading={isLoading}
          />
        )}

        {/* Help Section */}
        {account && !election && !isLoading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Election Data</h3>
            <p className="text-gray-600 mb-4">
              Unable to load election data. This could mean:
            </p>
            <ul className="text-left text-gray-600 space-y-1 max-w-md mx-auto">
              <li>• The contract is not deployed correctly</li>
              <li>• No elections have been created yet</li>
              <li>• You are connected to the wrong network</li>
              <li>• The contract address is incorrect</li>
            </ul>
            <button
              onClick={connectWallet}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}