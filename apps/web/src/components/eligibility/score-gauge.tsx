'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#00D4AA'; // accent-500
  if (score >= 40) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

function getScoreColorClass(score: number): string {
  if (score >= 70) return 'text-accent-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

export function ScoreGauge({ score, size = 160 }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    // Animate the score from 0 to the target value
    const duration = 1200;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [score]);

  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Score circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold', getScoreColorClass(score))} style={{ fontSize: size * 0.28 }}>
          {animatedScore}
        </span>
        <span className="text-muted-foreground" style={{ fontSize: size * 0.1 }}>
          /100
        </span>
      </div>
    </div>
  );
}
