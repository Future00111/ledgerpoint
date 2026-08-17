import React from 'react';
import { cn } from '@/lib/utils';

// Skeleton loading for Workspace tab content — progressive, never a blank screen.
export default function WorkspaceSkeleton({ lines = 5 }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 rounded bg-muted animate-pulse',
            i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-full' : 'w-1/2'
          )}
        />
      ))}
    </div>
  );
}