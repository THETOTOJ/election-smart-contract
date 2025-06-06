"use client";

import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract } from 'ethers';
import { CONTRACT_ADDRESS, VOTING_ABI, ELECTION_ID } from '@/lib/contract';
import { Election, ElectionResults } from '@/lib/types';
import WalletConnection from './WalletConnection';
import ElectionResultsComponent from './ElectionResults';
import CountdownTimer from './CountdownTimer';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-emerald-100 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">

        {/* Debug Toggle Button - Fixed Position */}
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-lg ${showDebug
                ? 'bg-green-700 text-white hover:bg-green-800'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
          >
            🔧 {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>

        {/* Collapsible Debug Info Panel */}
        {showDebug && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-sm mt-16">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-green-800 mb-2">🔧 Debug Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-green-700"><span className="font-medium">Contract:</span> {CONTRACT_ADDRESS}</p>
                    <p className="text-green-700"><span className="font-medium">Network:</span> Sepolia Testnet</p>
                    <p className="text-green-700"><span className="font-medium">Account:</span> {account || 'Not connected'}</p>
                  </div>
                  <div>
                    <p className="text-green-700"><span className="font-medium">Registered:</span> {isRegistered ? 'Yes' : 'No'}</p>
                    <p className="text-green-700"><span className="font-medium">Has Voted:</span> {hasVoted ? 'Yes' : 'No'}</p>
                    <p className="text-green-700"><span className="font-medium">Contract Connected:</span> {contract ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={testContract}
                  disabled={!contract || isLoading}
                  className="bg-green-700 text-white px-3 py-1 rounded text-xs hover:bg-green-800 disabled:opacity-50"
                >
                  Test Contract
                </button>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-green-700 hover:text-green-900 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paddy's Pub Header */}
        <div className="text-center bg-gradient-to-r from-green-800 via-green-700 to-green-600 text-white rounded-xl p-8 shadow-2xl border-4 border-green-400">
          <div className="mb-6">
            <div className="text-6xl mb-2">🍺</div>
            <h1 className="text-5xl font-bold mb-2 text-shadow-lg">
              PADDY'S PUB
            </h1>
            <div className="text-2xl font-semibold mb-6 text-green-200">
              ☘️ OWNER ELECTION 2024 ☘️
            </div>
          </div>

          {/* Episode Title Card Style */}
          <div className="bg-black text-white p-6 rounded-lg border-4 border-white shadow-2xl">
            <div className="text-center">
              <div className="text-xs font-bold text-gray-300 mb-2 tracking-wider">
                IT'S ALWAYS SUNNY IN PHILADELPHIA
              </div>
              <h2 className="text-3xl font-bold mb-2 tracking-wide">
                <Link href="https://iasip.app/tHRicN_N20-SAhC7HfvKsA" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  "The Gang Runs for Pub Owner"
                </Link>
              </h2>
              <div className="text-sm text-gray-300 italic">
                Season 29 • Episode 13
              </div>
            </div>
          </div>
        </div>



        {/* Error Display - Themed */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-red-600 text-2xl mr-3">🚨</div>
                <div>
                  <h3 className="text-red-800 font-bold">The Gang Encounters an Error!</h3>
                  <p className="text-red-700">{error}</p>
                  <p className="text-red-600 text-sm mt-1 italic">
                    "Wildcard, bitches!" - This error, probably
                  </p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-xl font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator - Themed */}
        {isLoading && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-3">🍺</div>
              <div>
                <p className="text-green-800 font-medium">Processing your vote...</p>
                <p className="text-green-600 text-sm italic">
                  "I'm gonna rise up, I'm gonna kick a little ass!" - Mac, probably about blockchain
                </p>
              </div>
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
            {/* Election Details - Themed */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-green-200">
              <div className="flex items-center mb-4">
                <span className="text-3xl mr-3">🏆</span>
                <h2 className="text-2xl font-bold text-green-800">Best Patty's pub owner</h2>
              </div>
              <p className="text-gray-700 mb-4 text-lg">{election.description}</p>

              {/* Runoff Information */}
              {election.isRunoff && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <span className="text-orange-600 text-2xl mr-3">🔄</span>
                    <div>
                      <h4 className="font-bold text-orange-800 text-lg">RUNOFF ELECTION!</h4>
                      <p className="text-orange-700">
                        "The Gang Has a Tie" - This is a runoff between the top candidates!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {election.requiresRunoff && election.runoffElectionId > 0 && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <span className="text-blue-600 text-2xl mr-3">⚖️</span>
                    <div>
                      <h4 className="font-bold text-blue-800 text-lg">TIE DETECTED!</h4>
                      <p className="text-blue-700">
                        A runoff election has been created! Check election #{election.runoffElectionId.toString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-green-50 p-4 rounded-lg">
                <div>
                  <span className="font-medium text-gray-700">Election ID:</span>
                  <p className="text-gray-600 font-bold">{election.id.toString()}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className={election.finalized ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                    {election.finalized ? '🔒 Finalized' : '🟢 Active'}
                  </p>
                </div>
                <div>
                  <button
                    onClick={refreshData}
                    disabled={isLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
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

        {/* Help Section - Themed */}
        {account && !election && !isLoading && (
          <div className="bg-white border-2 border-red-300 rounded-lg p-6 text-center">
            <div className="text-6xl mb-4">😵</div>
            <h3 className="text-xl font-bold text-red-800 mb-2">
              "The Gang Can't Find the Election Data"
            </h3>
            <p className="text-gray-700 mb-4 text-lg">
              Looks like Charlie might have eaten the contract data...
            </p>
            <ul className="text-left text-gray-600 space-y-2 max-w-md mx-auto bg-gray-50 p-4 rounded-lg">
              <li>🔧 The contract might not be deployed correctly</li>
              <li>📝 No elections have been created yet</li>
              <li>🌐 You might be connected to the wrong network</li>
              <li>📍 The contract address could be incorrect</li>
            </ul>
            <button
              onClick={connectWallet}
              className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold text-lg"
            >
              🔄 Try Again, Jabroni!
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 bg-white rounded-lg p-4 border border-green-200">
          <p className="text-sm">
            🍺 Powered by Blockchain Technology & The Gang's Questionable Decision Making 🍺
          </p>
          <p className="text-xs mt-1 italic">
            "And they have to vote for me because of the implication..." - Dennis, probably
          </p>
        </div>
      </div>
    </div>
  );
}