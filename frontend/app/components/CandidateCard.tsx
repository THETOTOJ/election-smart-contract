"use client";

import { useState } from 'react';

interface CandidateCardProps {
  id: bigint;
  name: string;
  imageUrl: string;
  voteCount: bigint;
  percentage: number;
  isLeading: boolean;
  canVote: boolean;
  isLoading: boolean;
  hasVoted: boolean;
  onVote: (candidateId: bigint) => Promise<void>;
}

export default function CandidateCard({
  id,
  name,
  imageUrl,
  voteCount,
  percentage,
  isLeading,
  canVote,
  isLoading,
  hasVoted,
  onVote
}: CandidateCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleVote = () => {
    if (canVote && !isLoading) {
      onVote(id);
    }
  };

  return (
    <div className={`w-80 bg-white rounded-xl border-2 shadow-lg transition-all duration-300 ${
      isLeading ? 'border-yellow-400 bg-yellow-50 shadow-yellow-100' : 'border-gray-200'
    } ${canVote ? 'hover:shadow-xl hover:border-blue-400 transform hover:scale-105' : ''}`}>
      
      {/* Leading Crown */}
      {isLeading && (
        <div className="absolute top-3 right-3 z-10 bg-yellow-400 rounded-full p-1">
          <span className="text-lg">👑</span>
        </div>
      )}

      {/* FIXED: Taller Image Container (portrait aspect ratio) */}
      <div className="relative w-full h-60 overflow-hidden bg-gray-100 rounded-t-xl">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover object-top" // object-top for portraits
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ 
            display: imageLoading ? 'none' : 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '320px',  // Card width (w-80 = 320px)
            height: '240px'  // Taller height (h-60 = 240px) - 4:3 portrait ratio
          }}
        />
        
        {imageError && (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
            <div className="text-center text-blue-700">
              <svg
                className="mx-auto h-12 w-12 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-sm font-bold">{name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Info */}
      <div className="p-6">
        {/* Name */}
        <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
          {name}
        </h3>

        {/* Vote Stats */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {voteCount.toString()}
            </div>
            <div className="text-sm text-gray-500">votes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">
              {percentage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">share</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
          <div
            className={`h-3 rounded-full transition-all duration-1000 ${
              isLeading ? 'bg-yellow-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.max(percentage, 3)}%` }}
          ></div>
        </div>

        {/* Vote Button */}
        {canVote ? (
          <button
            onClick={handleVote}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Voting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Vote for {name.split(' ')[0]}
              </>
            )}
          </button>
        ) : (
          <div className="w-full bg-gray-100 text-gray-500 py-4 px-6 rounded-lg font-bold text-lg text-center border-2 border-gray-200">
            {hasVoted ? '✓ Vote Recorded' : 'Register to Vote'}
          </div>
        )}
      </div>
    </div>
  );
}