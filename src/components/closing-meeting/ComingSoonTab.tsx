"use client";

import { Clock } from 'lucide-react';

interface ComingSoonTabProps {
  label: string;
}

export default function ComingSoonTab({ label }: ComingSoonTabProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-zinc-400">
      <Clock className="w-12 h-12" />
      <div className="text-center">
        <p className="text-lg font-medium">{label}</p>
        <p className="text-sm mt-1">준비 중입니다</p>
      </div>
    </div>
  );
}
