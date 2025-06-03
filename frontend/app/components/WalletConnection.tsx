"use client";

import { useState, useEffect } from 'react';

interface WalletConnectionProps {
  account: string | null;
  onConnect: () => Promise<void>;
  isRegistered: boolean;
  onRegister: () => Promise<void>;
  isLoading: boolean;
}

export default function WalletConnection({ 
  account, 
  onConnect, 
  isRegistered, 
  onRegister, 
  isLoading 
}: WalletConnectionProps) {
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);

  useEffect(() => {
    setIsMetaMaskInstalled(typeof window !== 'undefined' && typeof window.ethereum !== 'undefined');
  }, []);

  if (!isMetaMaskInstalled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-red-800 mb-2">MetaMask Required</h2>
        <p className="text-red-700 mb-4">
          Please install MetaMask to use this voting system.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
        >
          Install MetaMask
        </a>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
        <p className="text-gray-600 mb-6">
          Connect your MetaMask wallet to participate in voting.
        </p>
        <button
          onClick={onConnect}
          disabled={isLoading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Connecting...' : 'Connect MetaMask'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Wallet Connected</h2>
      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Address:</span> {account}
        </p>
        <p className="text-sm">
          <span className="font-medium">Status:</span>{' '}
          {isRegistered ? (
            <span className="text-green-600 font-medium">✅ Registered Voter</span>
          ) : (
            <span className="text-red-600 font-medium">❌ Not Registered</span>
          )}
        </p>
      </div>

      {!isRegistered && (
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Register to Vote</h3>
          <p className="text-sm text-gray-600 mb-4">
            You must register before you can participate in voting.
          </p>
          <button
            onClick={onRegister}
            disabled={isLoading}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register to Vote'}
          </button>
        </div>
      )}
    </div>
  );
}