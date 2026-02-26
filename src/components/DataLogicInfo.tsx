"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp, Database } from "lucide-react";

interface DataLogicInfoProps {
  title: string;
  description: string;
  steps: string[];
}

export default function DataLogicInfo({ title, description, steps }: DataLogicInfoProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title} 데이터 산출 로직</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">실시간 집계 방식 및 필터링 기준 안내</p>
          </div>
        </div>
        <div className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <Database className="w-4 h-4 text-zinc-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
            
            <div className="grid gap-2">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-3 px-3 py-2 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <span className="flex-none flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-600">
                    {index + 1}
                  </span>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                ※ 위 로직은 영일오엔씨 공식 집계 방식(Excel)을 시스템화하여 실시간으로 반영하고 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
