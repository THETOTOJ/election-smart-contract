"use client";

interface ElectionTimeInfoProps {
  startTime: bigint;
  endTime: bigint;
}

export default function ElectionTimeInfo({ startTime, endTime }: ElectionTimeInfoProps) {
  const formatDateTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-700 mb-3">📅 Election Schedule</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium text-gray-600">Started:</span>
          <p className="text-gray-800">{formatDateTime(startTime)}</p>
        </div>
        <div>
          <span className="font-medium text-gray-600">Ends:</span>
          <p className="text-gray-800">{formatDateTime(endTime)}</p>
        </div>
      </div>
    </div>
  );
}