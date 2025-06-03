"use client";

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  endTime: bigint; // Unix timestamp in seconds
  isActive: boolean;
  isFinalized: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer({ endTime, isActive, isFinalized }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const endTimeSeconds = Number(endTime);
      const difference = endTimeSeconds - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setIsExpired(false);
      setTimeLeft({
        days: Math.floor(difference / (24 * 60 * 60)),
        hours: Math.floor((difference % (24 * 60 * 60)) / (60 * 60)),
        minutes: Math.floor((difference % (60 * 60)) / 60),
        seconds: difference % 60
      });
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [endTime]);

  // Don't show countdown if election is finalized
  if (isFinalized) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-center">
          <div className="text-red-600 text-xl mr-2">🔒</div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-800">Election Finalized</h3>
            <p className="text-red-700">This election has been closed by the administrator</p>
          </div>
        </div>
      </div>
    );
  }

  // Show expired message
  if (isExpired || !isActive) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-center">
          <div className="text-orange-600 text-xl mr-2">⏰</div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-orange-800">Election Ended</h3>
            <p className="text-orange-700">Voting period has concluded</p>
          </div>
        </div>
      </div>
    );
  }

  // Show countdown
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">⏳ Time Remaining</h3>
        
        <div className="flex justify-center items-center gap-4">
          {/* Days */}
          {timeLeft.days > 0 && (
            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-lg p-3 min-w-16">
                <div className="text-2xl font-bold">{timeLeft.days}</div>
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {timeLeft.days === 1 ? 'Day' : 'Days'}
              </div>
            </div>
          )}
          
          {/* Hours */}
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-lg p-3 min-w-16">
              <div className="text-2xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</div>
            </div>
            <div className="text-sm text-blue-700 mt-1">Hours</div>
          </div>
          
          {/* Minutes */}
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-lg p-3 min-w-16">
              <div className="text-2xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</div>
            </div>
            <div className="text-sm text-blue-700 mt-1">Minutes</div>
          </div>
          
          {/* Seconds */}
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-lg p-3 min-w-16">
              <div className="text-2xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</div>
            </div>
            <div className="text-sm text-blue-700 mt-1">Seconds</div>
          </div>
        </div>

        {/* Urgency indicators */}
        {timeLeft.days === 0 && timeLeft.hours < 1 && (
          <div className="mt-4 text-red-600 font-semibold animate-pulse">
            🚨 Less than 1 hour remaining!
          </div>
        )}
        
        {timeLeft.days === 0 && timeLeft.hours < 24 && timeLeft.hours >= 1 && (
          <div className="mt-4 text-orange-600 font-semibold">
            ⚠️ Less than 24 hours remaining
          </div>
        )}
      </div>
    </div>
  );
}