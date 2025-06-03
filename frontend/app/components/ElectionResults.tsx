"use client";

import { ElectionResults as ElectionResultsType } from '@/lib/types';
import CandidateCard from './CandidateCard';

interface ElectionResultsProps {
  results: ElectionResultsType | null;
  hasVoted: boolean;
  onVote: (candidateId: bigint) => Promise<void>;
  isRegistered: boolean;
  isLoading: boolean;
}

const CANDIDATE_IMAGES: { [key: string]: string } = {
  "Charlie Kelly": "https://i.imgur.com/ZsWJOyC.jpeg",
  "Dennis Reynolds": "https://i.imgur.com/axJqB2S.jpeg", 
  "Mac": "https://i.imgur.com/O4Wuce7.png",
};

const DEFAULT_CANDIDATE_IMAGE = "https://via.placeholder.com/300x400/95A5A6/FFFFFF?text=Candidate";

export default function ElectionResults({ 
  results, 
  hasVoted, 
  onVote, 
  isRegistered, 
  isLoading 
}: ElectionResultsProps) {
  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-6"></div>
          <div className="flex flex-row gap-4 justify-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-80 space-y-3">
                <div className="h-60 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalVotes = results.voteCounts.reduce((sum, count) => sum + count, BigInt(0));

  // Calculate percentages and prepare candidate data
  const candidatesWithData = results.candidateNames.map((name, index) => {
    const votes = results.voteCounts[index];
    const percentage = totalVotes > BigInt(0) ? Number((votes * BigInt(100)) / totalVotes) : 0;
    
    // Get image with fallback
    const imageUrl = CANDIDATE_IMAGES[name] || DEFAULT_CANDIDATE_IMAGE;
    
    return {
      id: results.candidateIds[index],
      name,
      imageUrl,
      votes,
      percentage
    };
  });

  // Sort by vote count (descending)
  candidatesWithData.sort((a, b) => Number(b.votes - a.votes));

  const canVote = isRegistered && !hasVoted;

  return (
    <div className="space-y-6">
      
      {/* Voting Section Header - Only show if can vote */}
      {canVote && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-2 text-center">🗳️ Cast Your Vote</h2>
          <p className="text-gray-600 text-center">Choose your preferred candidate below</p>
        </div>
      )}

      {/* Already Voted Message - Only show if voted */}
      {hasVoted && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-center">
            <div className="text-green-600 text-2xl mr-3"></div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-green-800">✅ Vote Submitted Successfully!✅</h2>
              <p className="text-green-700">Grab your complementary drink from Dee at the bar</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Candidates Display */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {canVote ? '👥 Choose Your Candidate' : '📊 Live Results'}
          </h2>
          <div className="text-lg text-gray-600">
            Total votes cast: <span className="font-bold text-blue-600">{totalVotes.toString()}</span>
          </div>
        </div>

        {candidatesWithData.length > 0 ? (
          <div className="flex flex-row gap-6 justify-center items-start flex-wrap">
            {candidatesWithData.map((candidate, index) => (
              <div key={candidate.id.toString()} className="w-80 flex-shrink-0">
                <CandidateCard
                  id={candidate.id}
                  name={candidate.name}
                  imageUrl={candidate.imageUrl}
                  voteCount={candidate.votes}
                  percentage={candidate.percentage}
                  isLeading={index === 0 && totalVotes > BigInt(0)}
                  canVote={canVote}
                  isLoading={isLoading}
                  hasVoted={hasVoted}
                  onVote={onVote}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🗳️</div>
            <p className="text-lg font-medium">No candidates available yet</p>
            <p className="text-sm">The admin needs to add candidates to this election.</p>
          </div>
        )}

        {totalVotes === BigInt(0) && candidatesWithData.length > 0 && (
          <div className="text-center py-8 text-gray-500 border-t mt-8 pt-6">
            <p className="text-lg font-medium">No votes have been cast yet</p>
            <p className="text-sm">Be the first to vote! 🚀</p>
          </div>
        )}
      </div>
    </div>
  );
}