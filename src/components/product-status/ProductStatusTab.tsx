"use client";

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';
import CollapsibleSection from './CollapsibleSection';

interface QuarterData {
  quarter: string;
  actual: number;
  previousYear: number;
}

interface BreakdownItem {
  category: string;
  quarters: QuarterData[];
}

interface Section {
  id: string;
  title: string;
  data: BreakdownItem[];
}

interface ProductStatusData {
  sections: Section[];
  currentYear: number;
  lastYear: number;
}

interface TargetData {
  [year: string]: {
    [sectionId: string]: {
      [category: string]: {
        [quarter: string]: number;
      };
    };
  };
}

const STORAGE_KEY = 'product-status-targets';

export default function ProductStatusTab() {
  const [data, setData] = useState<ProductStatusData | null>(null);
  const [targets, setTargets] = useState<TargetData>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['auto-b2c-b2b']));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    loadTargets();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/dashboard/product-status');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch product status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargets = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTargets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load targets from localStorage:', error);
    }
  };

  const saveTarget = (sectionId: string, category: string, quarter: string, value: number) => {
    if (!data) return;

    const year = data.currentYear.toString();
    const newTargets = {
      ...targets,
      [year]: {
        ...targets[year],
        [sectionId]: {
          ...targets[year]?.[sectionId],
          [category]: {
            ...targets[year]?.[sectionId]?.[category],
            [quarter]: value
          }
        }
      }
    };

    setTargets(newTargets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTargets));
    } catch (error) {
      console.error('Failed to save targets to localStorage:', error);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add each section
    data.sections.forEach(section => {
      // Section title row
      exportData.push({ '구분': section.title });

      if (section.id === 'special-plus' || section.data.length === 0) {
        exportData.push({ '구분': '데이터 없음' });
        exportData.push({}); // Blank row
        return;
      }

      // Data rows
      section.data.forEach(item => {
        const row: any = { '구분': item.category };

        item.quarters.forEach(q => {
          const target = targets[data.currentYear]?.[section.id]?.[item.category]?.[q.quarter] || 0;
          const achievement = target > 0 ? (q.actual / target * 100) : 0;
          const yoy = q.previousYear > 0
            ? ((q.actual - q.previousYear) / q.previousYear * 100)
            : 0;

          row[`${q.quarter} 목표`] = target;
          row[`${q.quarter} 실적`] = Math.round(q.actual);
          row[`${q.quarter} 달성율(%)`] = target > 0 ? achievement.toFixed(1) : '-';
          row[`${q.quarter} 전년실적`] = Math.round(q.previousYear);
          row[`${q.quarter} 전년대비(%)`] = q.previousYear > 0 ? yoy.toFixed(1) : '-';
        });

        exportData.push(row);
      });

      exportData.push({}); // Blank row separator
    });

    const filename = generateFilename('제품별현황');
    exportToExcel(exportData, filename);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            제품별 현황
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {data.currentYear}년 분기별 제품 실적 ({data.lastYear}년 대비)
          </p>
        </div>
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          💡 <strong>목표</strong> 열을 클릭하여 분기별 목표를 입력하세요. 입력한 값은 브라우저에 자동 저장됩니다.
        </p>
      </div>

      {/* 9 Collapsible Sections */}
      <div className="space-y-4">
        {data.sections.map(section => (
          <CollapsibleSection
            key={section.id}
            section={section}
            targets={targets[data.currentYear]?.[section.id] || {}}
            onTargetChange={(cat, qtr, val) => saveTarget(section.id, cat, qtr, val)}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    </div>
  );
}
