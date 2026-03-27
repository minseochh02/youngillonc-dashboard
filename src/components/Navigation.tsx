'use client';

import { useState } from 'react';
import Link from "next/link";
import { LayoutDashboard, ClipboardList, Receipt, Package, Calculator, ShoppingCart, AlertTriangle, Star, ChevronDown, ChevronRight, X, Clock, Calendar, Users, FileText, BarChart3, DollarSign, UserX, TrendingUp, Database } from "lucide-react";
import { useStarredQueries } from '@/hooks/useStarredQueries';
import { regenerateSQLDates } from '@/lib/date-regenerator';
import { extractDatesFromSQL, formatDateRangeDisplay } from '@/lib/date-extractor';

interface NavItem {
  name: string;
  href: string;
  icon: JSX.Element;
}

interface NavGroup {
  name: string;
  icon: JSX.Element;
  items: NavItem[];
}

const Navigation = () => {
  const { queries: starredQueries, removeQuery } = useStarredQueries();
  const [isStarredExpanded, setIsStarredExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['매출/수금', '재고 관리']));

  const handleDeleteQuery = (e: React.MouseEvent, queryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('이 즐겨찾기를 삭제하시겠습니까?')) {
      removeQuery(queryId);
    }
  };

  const getQueryDateRange = (query: any) => {
    // Regenerate dates if it's a relative query
    const sql = regenerateSQLDates(query.sql, query.relativeDateType);
    const dates = extractDatesFromSQL(sql);

    if (!dates) return null;

    return formatDateRangeDisplay(dates.start, dates.end);
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const standaloneItems: NavItem[] = [
    {
      name: "직원별 현황",
      href: "/dashboard/employees",
      icon: <Users className="w-5 h-5" />,
    },
    {
      name: "대시보드",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: "일일현황",
      href: "/dashboard/daily-status",
      icon: <ClipboardList className="w-5 h-5" />,
    },
  ];

  const groupedItems: NavGroup[] = [
    {
      name: "매출/수금",
      icon: <TrendingUp className="w-5 h-5" />,
      items: [
        {
          name: "사업소별 매출/수금",
          href: "/dashboard/daily-status/sales",
          icon: <Receipt className="w-5 h-5" />,
        },
        {
          name: "판매현황",
          href: "/dashboard/sales-inventory",
          icon: <ShoppingCart className="w-5 h-5" />,
        },
        {
          name: "B2B 매출 분석",
          href: "/dashboard/b2b-daily-sales-analysis",
          icon: <BarChart3 className="w-5 h-5" />,
        },
        {
          name: "판매현황 분석",
          href: "/dashboard/sales-analysis",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ],
    },
    {
      name: "재고 관리",
      icon: <Package className="w-5 h-5" />,
      items: [
        {
          name: "재고현황",
          href: "/dashboard/inventory",
          icon: <Package className="w-5 h-5" />,
        },
        {
          name: "장기재고 관리",
          href: "/dashboard/long-term-inventory",
          icon: <AlertTriangle className="w-5 h-5" />,
        },
      ],
    },
    {
      name: "회의자료",
      icon: <FileText className="w-5 h-5" />,
      items: [
        {
          name: "마감회의",
          href: "/dashboard/closing-meeting",
          icon: <FileText className="w-5 h-5" />,
        },
        {
          name: "B2C 회의자료",
          href: "/dashboard/b2c-meetings",
          icon: <FileText className="w-5 h-5" />,
        },
        {
          name: "B2B 회의자료",
          href: "/dashboard/b2b-meetings",
          icon: <FileText className="w-5 h-5" />,
        },
      ],
    },
    {
      name: "미수금/업체",
      icon: <DollarSign className="w-5 h-5" />,
      items: [
        {
          name: "장기미수금 현황",
          href: "/dashboard/long-term-receivables",
          icon: <DollarSign className="w-5 h-5" />,
        },
        {
          name: "미거래업체 현황",
          href: "/dashboard/inactive-companies",
          icon: <UserX className="w-5 h-5" />,
        },
      ],
    },
  ];

  return (
    <nav className="w-64 bg-zinc-900 text-white min-h-screen p-4 flex flex-col gap-2">
      <div className="mb-8 px-2 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight">Youngil ONC</h1>
        <p className="text-xs text-zinc-400 mt-1">Management Dashboard</p>
      </div>

      <div className="flex flex-col gap-1">
        {/* Standalone items */}
        {standaloneItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
          >
            <span className="text-zinc-500 group-hover:text-blue-400 transition-colors">
              {item.icon}
            </span>
            <span className="text-sm font-medium">{item.name}</span>
          </Link>
        ))}

        {/* Grouped items with dropdowns */}
        {groupedItems.map((group) => {
          const isExpanded = expandedGroups.has(group.name);
          return (
            <div key={group.name} className="mt-2">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 group-hover:text-blue-400 transition-colors">
                    {group.icon}
                  </span>
                  <span className="text-sm font-medium">{group.name}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white group"
                    >
                      <span className="text-zinc-600 group-hover:text-blue-400 transition-colors">
                        {item.icon}
                      </span>
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data Management - Bottom Section */}
      <div className="mt-4">
        <Link
          href="/dashboard/data-management"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
        >
          <span className="text-zinc-500 group-hover:text-blue-400 transition-colors">
            <Database className="w-5 h-5" />
          </span>
          <span className="text-sm font-medium">데이터 관리</span>
        </Link>
      </div>

      {/* Templates Section */}
      <div className="mt-8 pt-4 border-t border-zinc-800">
        <button
          onClick={() => setIsStarredExpanded(!isStarredExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">템플릿</span>
            <span className="text-xs text-zinc-500">({starredQueries.length})</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isStarredExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isStarredExpanded && (
          <div className="mt-2 space-y-1 max-h-96 overflow-y-auto">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded-lg transition-colors font-medium"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>템플릿 추가</span>
            </Link>
            {starredQueries.map((query) => (
              <div key={query.id} className="relative group">
                <Link
                  href={`/dashboard?executeStarred=${query.id}`}
                  className="block px-3 py-2 pr-8 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate flex-1">
                      {query.relativeDateType && query.relativeDateType !== 'absolute' && (
                        <Clock className="w-3 h-3 text-blue-400 shrink-0" title="자동 날짜 업데이트" />
                      )}
                      <span className="truncate">{query.queryName}</span>
                    </div>
                    {query.executionCount > 0 && (
                      <span className="text-xs text-zinc-500 ml-2 shrink-0">
                        {query.executionCount}회
                      </span>
                    )}
                  </div>
                  {query.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {query.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const dateRange = getQueryDateRange(query);
                    return dateRange ? (
                      <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{dateRange}</span>
                      </div>
                    ) : null;
                  })()}
                </Link>
                <button
                  onClick={(e) => handleDeleteQuery(e, query.id)}
                  className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all"
                  title="삭제"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {starredQueries.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-500">
                저장된 템플릿이 없습니다
              </p>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
