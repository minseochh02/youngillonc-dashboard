"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface TeamDataRow {
  team: string;
  product_group: 'PVL' | 'CVL';
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface NambujisaRow {
  type: 'sales' | 'purchase';
  year: string;
  total_weight: number;
  total_amount: number;
}

interface NambujisaMonthRow {
  type: 'sales' | 'purchase';
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
}

interface StrategicDealerRow {
  dealer_name: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface StrategicDealerMonthRow {
  dealer_name: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface TeamStrategyData {
  teamData: TeamDataRow[];
  nambujisaData: NambujisaRow[];
  strategicDealers: StrategicDealerRow[];
  nambujisaMonthly?: NambujisaMonthRow[];
  strategicDealersMonthly?: StrategicDealerMonthRow[];
  currentYear: string;
  lastYear: string;
  currentMonth?: string;
}

interface TeamStrategyTabProps {
  selectedMonth?: string;
}

export default function TeamStrategyTab({ selectedMonth }: TeamStrategyTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<TeamStrategyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=team-strategy${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch team strategy data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  /** 당해 중량(L) + 전년 중량(작은 글씨) — SalesAnalysisTab YoYWeightCell과 동일 패턴 */
  const YoYWeightCell = ({
    current,
    last,
    accentClass,
    compact = false,
  }: {
    current: number;
    last: number;
    accentClass: string;
    compact?: boolean;
  }) => (
    <div
      className={`flex flex-col items-end justify-center leading-tight ${compact ? 'gap-0' : 'gap-0.5'}`}
    >
      <span
        className={`font-mono font-semibold tabular-nums ${accentClass} ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {formatNumber(current)}
      </span>
      <span
        className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}
      >
        전년 {formatNumber(last)}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
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

  const {
    currentYear,
    lastYear,
    teamData,
    nambujisaData,
    strategicDealers,
    nambujisaMonthly = [],
    strategicDealersMonthly = [],
    currentMonth: apiCurrentMonth,
  } = data;

  const targetMonth = selectedMonth || apiCurrentMonth || `${currentYear}-12`;
  const [_, currentMonthNum] = targetMonth.split('-');
  const selectedMonthNum = parseInt(currentMonthNum, 10);

  const rateColThClass =
    'text-right py-2 pl-1 pr-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap';
  const rateColTdClassCompact = 'py-1.5 pl-1 pr-1.5 text-right align-middle';

  const getTeamMonthWeights = (team: string, year: string, monthMM: string) => {
    let pv = 0;
    let cv = 0;
    const ym = `${year}-${monthMM}`;
    for (const row of teamData) {
      if (row.team === team && row.year === year && row.year_month === ym) {
        if (row.product_group === 'PVL') pv += row.total_weight;
        else if (row.product_group === 'CVL') cv += row.total_weight;
      }
    }
    return { pv, cv };
  };

  const nambujisaMonthLookup = new Map<string, number>();
  nambujisaMonthly.forEach((r) => {
    nambujisaMonthLookup.set(`${r.type}|${r.year}|${r.year_month}`, r.total_weight);
  });

  const getNambujisaMonth = (type: 'sales' | 'purchase', monthMM: string) => {
    const ymc = `${currentYear}-${monthMM}`;
    const yml = `${lastYear}-${monthMM}`;
    return {
      cur: nambujisaMonthLookup.get(`${type}|${currentYear}|${ymc}`) ?? 0,
      last: nambujisaMonthLookup.get(`${type}|${lastYear}|${yml}`) ?? 0,
    };
  };

  const dealerMonthLookup = new Map<string, number>();
  strategicDealersMonthly.forEach((r) => {
    dealerMonthLookup.set(`${r.dealer_name}|${r.year}|${r.year_month}`, r.total_weight);
  });

  const getDealerMonthWeights = (dealerName: string, monthMM: string) => {
    const ymc = `${currentYear}-${monthMM}`;
    const yml = `${lastYear}-${monthMM}`;
    return {
      cur: dealerMonthLookup.get(`${dealerName}|${currentYear}|${ymc}`) ?? 0,
      last: dealerMonthLookup.get(`${dealerName}|${lastYear}|${yml}`) ?? 0,
    };
  };

  // Aggregate team data by team and product group for each year
  const aggregateTeamData = () => {
    const aggregated = new Map<string, { pv: number; cv: number }>();

    [currentYear, lastYear].forEach(year => {
      const yearData = teamData.filter(row => row.year === year);
      const teams = new Set(yearData.map(row => row.team));

      teams.forEach(team => {
        const key = `${team}-${year}`;
        const pvWeight = yearData
          .filter(row => row.team === team && row.product_group === 'PVL')
          .reduce((sum, row) => sum + row.total_weight, 0);
        const cvWeight = yearData
          .filter(row => row.team === team && row.product_group === 'CVL')
          .reduce((sum, row) => sum + row.total_weight, 0);

        aggregated.set(key, { pv: pvWeight, cv: cvWeight });
      });
    });

    return aggregated;
  };

  const teamAggregated = aggregateTeamData();

  // Get unique teams
  const teams = Array.from(new Set(teamData.map(row => row.team))).sort();

  const getAllTeamsMonthWeights = (year: string, monthMM: string) => {
    let pv = 0;
    let cv = 0;
    for (const t of teams) {
      const w = getTeamMonthWeights(t, year, monthMM);
      pv += w.pv;
      cv += w.cv;
    }
    return { pv, cv };
  };

  // Calculate totals
  const calculateTotals = () => {
    const totals = new Map<string, { pv: number; cv: number }>();

    [currentYear, lastYear].forEach(year => {
      const yearData = teamData.filter(row => row.year === year);
      const pvTotal = yearData
        .filter(row => row.product_group === 'PVL')
        .reduce((sum, row) => sum + row.total_weight, 0);
      const cvTotal = yearData
        .filter(row => row.product_group === 'CVL')
        .reduce((sum, row) => sum + row.total_weight, 0);

      totals.set(year, { pv: pvTotal, cv: cvTotal });
    });

    return totals;
  };

  const totals = calculateTotals();

  // Process 남부지사 data
  const nambujisaSummary = {
    [currentYear]: {
      sales: nambujisaData.find(row => row.type === 'sales' && row.year === currentYear)?.total_weight || 0,
      purchase: nambujisaData.find(row => row.type === 'purchase' && row.year === currentYear)?.total_weight || 0,
    },
    [lastYear]: {
      sales: nambujisaData.find(row => row.type === 'sales' && row.year === lastYear)?.total_weight || 0,
      purchase: nambujisaData.find(row => row.type === 'purchase' && row.year === lastYear)?.total_weight || 0,
    },
  };

  // Process strategic dealers
  const dealersSummary = new Map<string, { current: number; last: number }>();
  strategicDealers.forEach(row => {
    if (!dealersSummary.has(row.dealer_name)) {
      dealersSummary.set(row.dealer_name, { current: 0, last: 0 });
    }
    const summary = dealersSummary.get(row.dealer_name)!;
    if (row.year === currentYear) {
      summary.current += row.total_weight;
    } else if (row.year === lastYear) {
      summary.last += row.total_weight;
    }
  });

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    // PVL/CVL by Team section
    exportData.push({ '구분': 'PVL/CVL 팀별 분석' });
    exportData.push({
      '팀명': '팀명',
      [`${currentYear} PVL`]: `${currentYear} PVL`,
      [`${lastYear} PVL`]: `${lastYear} PVL`,
      'PVL 변화율(%)': 'PVL 변화율(%)',
      [`${currentYear} CVL`]: `${currentYear} CVL`,
      [`${lastYear} CVL`]: `${lastYear} CVL`,
      'CVL 변화율(%)': 'CVL 변화율(%)',
    });

    teams.forEach(team => {
      const currentData = teamAggregated.get(`${team}-${currentYear}`) || { pv: 0, cv: 0 };
      const lastData = teamAggregated.get(`${team}-${lastYear}`) || { pv: 0, cv: 0 };
      const pvCh = calculateChange(currentData.pv, lastData.pv);
      const cvCh = calculateChange(currentData.cv, lastData.cv);

      exportData.push({
        '팀명': team,
        [`${currentYear} PVL`]: currentData.pv,
        [`${lastYear} PVL`]: lastData.pv,
        'PVL 변화율(%)': Number(pvCh.percent.toFixed(1)),
        [`${currentYear} CVL`]: currentData.cv,
        [`${lastYear} CVL`]: lastData.cv,
        'CVL 변화율(%)': Number(cvCh.percent.toFixed(1)),
      });
    });

    exportData.push({ '구분': '팀별 PVL/CVL 월별' });
    exportData.push({
      팀명: '팀명',
      월: '월',
      [`${currentYear} PVL`]: `${currentYear} PVL`,
      [`${lastYear} PVL`]: `${lastYear} PVL`,
      [`${currentYear} CVL`]: `${currentYear} CVL`,
      [`${lastYear} CVL`]: `${lastYear} CVL`,
    });
    teams.forEach((team) => {
      exportData.push({
        팀명: team,
        월: '누계',
        [`${currentYear} PVL`]: (teamAggregated.get(`${team}-${currentYear}`) || { pv: 0, cv: 0 }).pv,
        [`${lastYear} PVL`]: (teamAggregated.get(`${team}-${lastYear}`) || { pv: 0, cv: 0 }).pv,
        [`${currentYear} CVL`]: (teamAggregated.get(`${team}-${currentYear}`) || { pv: 0, cv: 0 }).cv,
        [`${lastYear} CVL`]: (teamAggregated.get(`${team}-${lastYear}`) || { pv: 0, cv: 0 }).cv,
      });
      for (let m = 1; m <= selectedMonthNum; m++) {
        const mm = String(m).padStart(2, '0');
        const curW = getTeamMonthWeights(team, currentYear, mm);
        const lastW = getTeamMonthWeights(team, lastYear, mm);
        exportData.push({
          팀명: team,
          월: `${m}월`,
          [`${currentYear} PVL`]: curW.pv,
          [`${lastYear} PVL`]: lastW.pv,
          [`${currentYear} CVL`]: curW.cv,
          [`${lastYear} CVL`]: lastW.cv,
        });
      }
    });

    exportData.push({});

    // 남부지사 section
    exportData.push({ '구분': '남부지사 매입/매출' });
    exportData.push({
      '구분': '항목',
      [currentYear]: currentYear,
      [lastYear]: lastYear,
    });
    exportData.push({
      '구분': '매입',
      [currentYear]: nambujisaSummary[currentYear].purchase,
      [lastYear]: nambujisaSummary[lastYear].purchase,
    });
    exportData.push({
      '구분': '매출',
      [currentYear]: nambujisaSummary[currentYear].sales,
      [lastYear]: nambujisaSummary[lastYear].sales,
    });

    exportData.push({});

    // Strategic dealers section
    exportData.push({ '구분': '전략딜러' });
    exportData.push({
      '판매처명': '판매처명',
      [currentYear]: currentYear,
      [lastYear]: lastYear,
      '변화율': '변화율(%)',
    });

    dealersSummary.forEach((values, dealerName) => {
      const change = calculateChange(values.current, values.last);
      exportData.push({
        '판매처명': dealerName,
        [currentYear]: values.current,
        [lastYear]: values.last,
        '변화율': change.percent.toFixed(1),
      });
    });

    const filename = generateFilename('팀및전략딜러');
    exportToExcel(exportData, filename);
  };

  const currentTotals = totals.get(currentYear) || { pv: 0, cv: 0 };
  const lastTotals = totals.get(lastYear) || { pv: 0, cv: 0 };
  const pvChange = calculateChange(currentTotals.pv, lastTotals.pv);
  const cvChange = calculateChange(currentTotals.cv, lastTotals.cv);

  const totalCurrentWeight = currentTotals.pv + currentTotals.cv;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PVL Performance Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">팀별 PVL 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">1월~{selectedMonthNum}월 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">PVL 총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(currentTotals.pv)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((currentTotals.pv / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${pvChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {pvChange.isPositive ? '+' : ''}{pvChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(lastTotals.pv)} L
              </p>
            </div>
          </div>
        </div>

        {/* CVL Performance Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">팀별 CVL 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">1월~{selectedMonthNum}월 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">CVL 총 중량</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(currentTotals.cv)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((currentTotals.cv / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${cvChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {cvChange.isPositive ? '+' : ''}{cvChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(lastTotals.cv)} L
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PVL/CVL by Team */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            PVL/CVL 팀별 분석
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              용량 (L) — 당해 누계 + 전년 ({currentYear} vs {lastYear})
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  팀명
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  PVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    용량 (L)
                  </span>
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-4 text-xs font-bold text-emerald-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  CVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    용량 (L)
                  </span>
                </th>
              </tr>
              <tr>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  변화율
                </th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  변화율
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => {
                const currentData = teamAggregated.get(`${team}-${currentYear}`) || { pv: 0, cv: 0 };
                const lastData = teamAggregated.get(`${team}-${lastYear}`) || { pv: 0, cv: 0 };
                const pvChange = calculateChange(currentData.pv, lastData.pv);
                const cvChange = calculateChange(currentData.cv, lastData.cv);

                return (
                  <tr
                    key={team}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">{team}</td>
                    <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                      <YoYWeightCell
                        current={currentData.pv}
                        last={lastData.pv}
                        accentClass="text-blue-700 dark:text-blue-300"
                        compact
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        pvChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {pvChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(pvChange.percent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                      <YoYWeightCell
                        current={currentData.cv}
                        last={lastData.cv}
                        accentClass="text-blue-700 dark:text-blue-300"
                        compact
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        cvChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {cvChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(cvChange.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">팀합계</td>
                <td className="py-3 px-4 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={totals.get(currentYear)?.pv || 0}
                    last={totals.get(lastYear)?.pv || 0}
                    accentClass="text-blue-800 dark:text-blue-200"
                    compact
                  />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    calculateChange(totals.get(currentYear)?.pv || 0, totals.get(lastYear)?.pv || 0).isPositive
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(calculateChange(totals.get(currentYear)?.pv || 0, totals.get(lastYear)?.pv || 0).percent).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={totals.get(currentYear)?.cv || 0}
                    last={totals.get(lastYear)?.cv || 0}
                    accentClass="text-blue-800 dark:text-blue-200"
                    compact
                  />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    calculateChange(totals.get(currentYear)?.cv || 0, totals.get(lastYear)?.cv || 0).isPositive
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(calculateChange(totals.get(currentYear)?.cv || 0, totals.get(lastYear)?.cv || 0).percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 팀별 PVL/CVL 월별 상세 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            팀별 PVL/CVL 월별 상세 (누계: 1월~{selectedMonthNum}월)
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            용량 (L) — 월별 실적 당해·전년 비교 ({currentYear} vs {lastYear})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[7rem]" />
              <col className="w-16" />
              <col />
              <col className="w-14" />
              <col />
              <col className="w-14" />
            </colgroup>
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  팀
                </th>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  월
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-2 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  PVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">용량 (L)</span>
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-2 text-xs font-bold text-emerald-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  CVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">용량 (L)</span>
                </th>
              </tr>
              <tr>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>변화율</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>변화율</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const currentData = teamAggregated.get(`${team}-${currentYear}`) || { pv: 0, cv: 0 };
                const lastData = teamAggregated.get(`${team}-${lastYear}`) || { pv: 0, cv: 0 };
                const cumPvCh = calculateChange(currentData.pv, lastData.pv);
                const cumCvCh = calculateChange(currentData.cv, lastData.cv);
                return (
                  <Fragment key={team}>
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                      <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{team}</td>
                      <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                      <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        <YoYWeightCell
                          current={currentData.pv}
                          last={lastData.pv}
                          accentClass="text-blue-700 dark:text-blue-300"
                          compact
                        />
                      </td>
                      <td className={rateColTdClassCompact}>
                        <span
                          className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                            cumPvCh.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {cumPvCh.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(cumPvCh.percent).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        <YoYWeightCell
                          current={currentData.cv}
                          last={lastData.cv}
                          accentClass="text-emerald-700 dark:text-emerald-300"
                          compact
                        />
                      </td>
                      <td className={rateColTdClassCompact}>
                        <span
                          className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                            cumCvCh.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {cumCvCh.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(cumCvCh.percent).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                    {Array.from({ length: selectedMonthNum }, (_, i) => {
                      const monthMM = String(i + 1).padStart(2, '0');
                      const curW = getTeamMonthWeights(team, currentYear, monthMM);
                      const lastW = getTeamMonthWeights(team, lastYear, monthMM);
                      const pvCh = calculateChange(curW.pv, lastW.pv);
                      const cvCh = calculateChange(curW.cv, lastW.cv);
                      return (
                        <tr
                          key={`${team}-${monthMM}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-2 px-2" />
                          <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{i + 1}월</td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <YoYWeightCell
                              current={curW.pv}
                              last={lastW.pv}
                              accentClass="text-zinc-900 dark:text-zinc-100"
                              compact
                            />
                          </td>
                          <td className={rateColTdClassCompact}>
                            <span
                              className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                pvCh.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {Math.abs(pvCh.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <YoYWeightCell
                              current={curW.cv}
                              last={lastW.cv}
                              accentClass="text-zinc-900 dark:text-zinc-100"
                              compact
                            />
                          </td>
                          <td className={rateColTdClassCompact}>
                            <span
                              className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                cvCh.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {Math.abs(cvCh.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold border-t-2 border-zinc-300 dark:border-zinc-600">
                <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100">팀합계</td>
                <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100">누계</td>
                <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={totals.get(currentYear)?.pv || 0}
                    last={totals.get(lastYear)?.pv || 0}
                    accentClass="text-blue-800 dark:text-blue-200"
                    compact
                  />
                </td>
                <td className={rateColTdClassCompact}>
                  <span
                    className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                      calculateChange(totals.get(currentYear)?.pv || 0, totals.get(lastYear)?.pv || 0).isPositive
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.abs(
                      calculateChange(totals.get(currentYear)?.pv || 0, totals.get(lastYear)?.pv || 0).percent
                    ).toFixed(1)}
                    %
                  </span>
                </td>
                <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={totals.get(currentYear)?.cv || 0}
                    last={totals.get(lastYear)?.cv || 0}
                    accentClass="text-emerald-800 dark:text-emerald-200"
                    compact
                  />
                </td>
                <td className={rateColTdClassCompact}>
                  <span
                    className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                      calculateChange(totals.get(currentYear)?.cv || 0, totals.get(lastYear)?.cv || 0).isPositive
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.abs(
                      calculateChange(totals.get(currentYear)?.cv || 0, totals.get(lastYear)?.cv || 0).percent
                    ).toFixed(1)}
                    %
                  </span>
                </td>
              </tr>
              {Array.from({ length: selectedMonthNum }, (_, i) => {
                const monthMM = String(i + 1).padStart(2, '0');
                const curT = getAllTeamsMonthWeights(currentYear, monthMM);
                const lastT = getAllTeamsMonthWeights(lastYear, monthMM);
                const pvCh = calculateChange(curT.pv, lastT.pv);
                const cvCh = calculateChange(curT.cv, lastT.cv);
                return (
                  <tr
                    key={`all-${monthMM}`}
                    className="bg-zinc-50/80 dark:bg-zinc-800/40 font-semibold border-b border-zinc-100 dark:border-zinc-800/60"
                  >
                    <td className="py-2 px-2 text-zinc-500 dark:text-zinc-400 text-xs" />
                    <td className="py-2 px-2 text-zinc-800 dark:text-zinc-200 text-sm">{i + 1}월 합계</td>
                    <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                      <YoYWeightCell
                        current={curT.pv}
                        last={lastT.pv}
                        accentClass="text-blue-800 dark:text-blue-200"
                        compact
                      />
                    </td>
                    <td className={rateColTdClassCompact}>
                      <span
                        className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                          pvCh.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Math.abs(pvCh.percent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                      <YoYWeightCell
                        current={curT.cv}
                        last={lastT.cv}
                        accentClass="text-emerald-800 dark:text-emerald-200"
                        compact
                      />
                    </td>
                    <td className={rateColTdClassCompact}>
                      <span
                        className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                          cvCh.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Math.abs(cvCh.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 남부지사 Detail */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            남부지사 매입/매출 (1월~{selectedMonthNum}월 누계)
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              용량 (L) — 당해 누계 + 전년 ({currentYear} vs {lastYear})
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">구분</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">
                  용량 (L)
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    당해 · 전년
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">매입</td>
                <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                  <YoYWeightCell
                    current={nambujisaSummary[currentYear].purchase}
                    last={nambujisaSummary[lastYear].purchase}
                    accentClass="text-blue-700 dark:text-blue-300"
                    compact
                  />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    calculateChange(nambujisaSummary[currentYear].purchase, nambujisaSummary[lastYear].purchase).isPositive
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(calculateChange(nambujisaSummary[currentYear].purchase, nambujisaSummary[lastYear].purchase).percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">매출</td>
                <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                  <YoYWeightCell
                    current={nambujisaSummary[currentYear].sales}
                    last={nambujisaSummary[lastYear].sales}
                    accentClass="text-blue-700 dark:text-blue-300"
                    compact
                  />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    calculateChange(nambujisaSummary[currentYear].sales, nambujisaSummary[lastYear].sales).isPositive
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(calculateChange(nambujisaSummary[currentYear].sales, nambujisaSummary[lastYear].sales).percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 남부지사 월별 상세 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            남부지사 월별 상세 (누계: 1월~{selectedMonthNum}월)
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            용량 (L) — 월별 실적 당해·전년 비교 ({currentYear} vs {lastYear})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-28" />
              <col className="w-16" />
              <col />
              <col className="w-14" />
            </colgroup>
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">구분</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">월</th>
                <th className="text-right py-3 px-2 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">
                  용량 (L)
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">당해 · 전년</span>
                </th>
                <th className={rateColThClass}>변화율</th>
              </tr>
            </thead>
            <tbody>
              {(['purchase', 'sales'] as const).map((kind) => {
                const label = kind === 'purchase' ? '매입' : '매출';
                const cumCur =
                  kind === 'purchase'
                    ? nambujisaSummary[currentYear].purchase
                    : nambujisaSummary[currentYear].sales;
                const cumLast =
                  kind === 'purchase'
                    ? nambujisaSummary[lastYear].purchase
                    : nambujisaSummary[lastYear].sales;
                const cumCh = calculateChange(cumCur, cumLast);
                return (
                  <Fragment key={kind}>
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                      <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{label}</td>
                      <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                      <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        <YoYWeightCell
                          current={cumCur}
                          last={cumLast}
                          accentClass="text-blue-700 dark:text-blue-300"
                          compact
                        />
                      </td>
                      <td className={rateColTdClassCompact}>
                        <span
                          className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                            cumCh.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {cumCh.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(cumCh.percent).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                    {Array.from({ length: selectedMonthNum }, (_, i) => {
                      const monthMM = String(i + 1).padStart(2, '0');
                      const w = getNambujisaMonth(kind, monthMM);
                      const ch = calculateChange(w.cur, w.last);
                      return (
                        <tr
                          key={`${kind}-${monthMM}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-2 px-2" />
                          <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{i + 1}월</td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <YoYWeightCell
                              current={w.cur}
                              last={w.last}
                              accentClass="text-zinc-900 dark:text-zinc-100"
                              compact
                            />
                          </td>
                          <td className={rateColTdClassCompact}>
                            <span
                              className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                ch.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {Math.abs(ch.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Dealers */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            전략딜러 (1월~{selectedMonthNum}월 누계)
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              용량 (L) — 당해 누계 + 전년 ({currentYear} vs {lastYear})
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">판매처명</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">
                  용량 (L)
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    당해 · 전년
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(dealersSummary.entries()).map(([dealerName, values]) => {
                const change = calculateChange(values.current, values.last);

                return (
                  <tr
                    key={dealerName}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">{dealerName}</td>
                    <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                      <YoYWeightCell
                        current={values.current}
                        last={values.last}
                        accentClass="text-blue-700 dark:text-blue-300"
                        compact
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        change.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {change.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(change.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">총합계</td>
                <td className="py-3 px-4 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0)}
                    last={Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)}
                    accentClass="text-blue-800 dark:text-blue-200"
                    compact
                  />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    calculateChange(
                      Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0),
                      Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)
                    ).isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(calculateChange(
                      Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0),
                      Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)
                    ).percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 전략딜러 월별 상세 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            전략딜러 월별 상세 (누계: 1월~{selectedMonthNum}월)
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            용량 (L) — 월별 실적 당해·전년 비교 ({currentYear} vs {lastYear})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[7rem]" />
              <col className="w-16" />
              <col />
              <col className="w-14" />
            </colgroup>
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">판매처명</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">월</th>
                <th className="text-right py-3 px-2 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">
                  용량 (L)
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">당해 · 전년</span>
                </th>
                <th className={rateColThClass}>변화율</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(dealersSummary.entries()).map(([dealerName, values]) => {
                const cumCh = calculateChange(values.current, values.last);
                return (
                  <Fragment key={`m-${dealerName}`}>
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                      <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{dealerName}</td>
                      <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                      <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        <YoYWeightCell
                          current={values.current}
                          last={values.last}
                          accentClass="text-blue-700 dark:text-blue-300"
                          compact
                        />
                      </td>
                      <td className={rateColTdClassCompact}>
                        <span
                          className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                            cumCh.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {cumCh.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(cumCh.percent).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                    {Array.from({ length: selectedMonthNum }, (_, i) => {
                      const monthMM = String(i + 1).padStart(2, '0');
                      const w = getDealerMonthWeights(dealerName, monthMM);
                      const ch = calculateChange(w.cur, w.last);
                      return (
                        <tr
                          key={`${dealerName}-${monthMM}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-2 px-2" />
                          <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{i + 1}월</td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <YoYWeightCell
                              current={w.cur}
                              last={w.last}
                              accentClass="text-zinc-900 dark:text-zinc-100"
                              compact
                            />
                          </td>
                          <td className={rateColTdClassCompact}>
                            <span
                              className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                ch.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {Math.abs(ch.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold border-t-2 border-zinc-300 dark:border-zinc-600">
                <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100">총합계</td>
                <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100">누계</td>
                <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                  <YoYWeightCell
                    current={Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0)}
                    last={Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)}
                    accentClass="text-blue-800 dark:text-blue-200"
                    compact
                  />
                </td>
                <td className={rateColTdClassCompact}>
                  <span
                    className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                      calculateChange(
                        Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0),
                        Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)
                      ).isPositive
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.abs(
                      calculateChange(
                        Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.current, 0),
                        Array.from(dealersSummary.values()).reduce((sum, v) => sum + v.last, 0)
                      ).percent
                    ).toFixed(1)}
                    %
                  </span>
                </td>
              </tr>
              {Array.from({ length: selectedMonthNum }, (_, i) => {
                const monthMM = String(i + 1).padStart(2, '0');
                let curSum = 0;
                let lastSum = 0;
                dealersSummary.forEach((_, dealerName) => {
                  const w = getDealerMonthWeights(dealerName, monthMM);
                  curSum += w.cur;
                  lastSum += w.last;
                });
                const ch = calculateChange(curSum, lastSum);
                return (
                  <tr
                    key={`dealer-all-${monthMM}`}
                    className="bg-zinc-50/80 dark:bg-zinc-800/40 font-semibold border-b border-zinc-100 dark:border-zinc-800/60"
                  >
                    <td className="py-2 px-2 text-zinc-500 dark:text-zinc-400 text-xs" />
                    <td className="py-2 px-2 text-zinc-800 dark:text-zinc-200 text-sm">{i + 1}월 합계</td>
                    <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                      <YoYWeightCell
                        current={curSum}
                        last={lastSum}
                        accentClass="text-blue-800 dark:text-blue-200"
                        compact
                      />
                    </td>
                    <td className={rateColTdClassCompact}>
                      <span
                        className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                          ch.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Math.abs(ch.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: (품목그룹1코드)</li>
          <li>팀별: employee_category.b2c_팀 기준</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
