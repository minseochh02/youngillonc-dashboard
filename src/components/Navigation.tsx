'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from "next/link";
import { LayoutDashboard, ClipboardList, Receipt, Package, ShoppingCart, AlertTriangle, Star, ChevronDown, ChevronRight, X, Clock, Calendar, Users, FileText, BarChart3, DollarSign, UserX, TrendingUp, Database, Settings, Cloud, ChevronsLeft, ChevronsRight, Target } from "lucide-react";
import { useStarredQueries } from '@/hooks/useStarredQueries';
import { regenerateSQLDates } from '@/lib/date-regenerator';
import { extractDatesFromSQL, formatDateRangeDisplay } from '@/lib/date-extractor';

interface NavItem {
  name: string;
  href: string;
  icon: ReactElement;
}

interface NavGroup {
  name: string;
  icon: ReactElement;
  items: NavItem[];
}

const SIDEBAR_COLLAPSED_KEY = 'dashboard-sidebar-collapsed';

const Navigation = () => {
  const { queries: starredQueries, removeQuery } = useStarredQueries();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isStarredExpanded, setIsStarredExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['매출/수금', '재고 관리']));
  const [flyout, setFlyout] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      /* ignore */
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!flyout) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (navRef.current?.contains(t) || flyoutRef.current?.contains(t)) return;
      setFlyout(null);
    };
    const closeOnMove = () => setFlyout(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeOnMove, true);
    window.addEventListener('resize', closeOnMove);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeOnMove, true);
      window.removeEventListener('resize', closeOnMove);
    };
  }, [flyout]);

  const openFlyoutMenu = (id: string, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect();
    setFlyout((prev) =>
      prev?.id === id ? null : { id, top: r.top, left: r.right + 8 }
    );
  };

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
          name: "고객 배정 관리",
          href: "/dashboard/client-assignments",
          icon: <Users className="w-5 h-5" />,
        },
        {
          name: "일괄 목표 설정",
          href: "/dashboard/bulk-goal-setting",
          icon: <Target className="w-5 h-5" />,
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
    {
      name: "설정",
      icon: <Settings className="w-5 h-5" />,
      items: [
        {
          name: "Google Drive 연동",
          href: "/dashboard/employees/drive-settings",
          icon: <Cloud className="w-5 h-5" />,
        },
      ],
    },
  ];

  const closeFlyout = () => setFlyout(null);

  const flyoutGroup =
    flyout?.id.startsWith('group:') === true
      ? groupedItems.find((g) => `group:${g.name}` === flyout.id)
      : undefined;

  const linkRowClass = (collapsed: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group ${
      collapsed ? 'justify-center' : ''
    }`;

  const starredTemplatesList = (opts?: { afterNavigate?: () => void }) => (
    <div
      className={`space-y-1 max-h-96 overflow-y-auto ${opts?.afterNavigate ? '' : 'mt-2'}`}
    >
      <Link
        href="/dashboard"
        onClick={opts?.afterNavigate}
        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded-lg transition-colors font-medium"
      >
        <LayoutDashboard className="w-4 h-4 shrink-0" />
        <span>템플릿 추가</span>
      </Link>
      {starredQueries.map((query) => (
        <div key={query.id} className="relative group">
          <Link
            href={`/dashboard?executeStarred=${query.id}`}
            onClick={opts?.afterNavigate}
            className="block px-3 py-2 pr-8 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 truncate flex-1 min-w-0">
                {query.relativeDateType && query.relativeDateType !== 'absolute' && (
                  <span className="inline-flex shrink-0" title="자동 날짜 업데이트">
                    <Clock className="w-3 h-3 text-blue-400" />
                  </span>
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
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{dateRange}</span>
                </div>
              ) : null;
            })()}
          </Link>
          <button
            type="button"
            onClick={(e) => handleDeleteQuery(e, query.id)}
            className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all"
            title="삭제"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      {starredQueries.length === 0 && (
        <p className="px-3 py-2 text-xs text-zinc-500">저장된 템플릿이 없습니다</p>
      )}
    </div>
  );

  return (
    <>
      <nav
        ref={navRef}
        className={`shrink-0 bg-zinc-900 text-white h-screen sticky top-0 flex flex-col transition-[width] duration-200 ease-out ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div
          className={`shrink-0 border-b border-zinc-800 ${
            isCollapsed
              ? 'p-2 flex flex-col items-center gap-1'
              : 'px-4 py-4 flex items-start justify-between gap-2'
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight">Youngil ONC</h1>
                <p className="text-xs text-zinc-400 mt-1">Management Dashboard</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                aria-label="사이드바 접기"
                title="사이드바 접기"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              aria-label="사이드바 펼치기"
              title="사이드바 펼치기"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-3">
          <div className="flex flex-col gap-1">
            {standaloneItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={linkRowClass(isCollapsed)}
              >
                <span className="text-zinc-500 group-hover:text-blue-400 transition-colors shrink-0">
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium truncate">{item.name}</span>
                )}
              </Link>
            ))}

            {groupedItems.map((group) => {
              const isExpanded = expandedGroups.has(group.name);
              return (
                <div key={group.name} className="mt-2 first:mt-0">
                  {isCollapsed ? (
                    <button
                      type="button"
                      title={group.name}
                      aria-label={group.name}
                      onClick={(e) =>
                        openFlyoutMenu(`group:${group.name}`, e.currentTarget)
                      }
                      className="w-full flex items-center justify-center px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
                    >
                      <span className="text-zinc-500 group-hover:text-blue-400 transition-colors">
                        {group.icon}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.name)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-zinc-500 group-hover:text-blue-400 transition-colors shrink-0">
                            {group.icon}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {group.name}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
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
                              <span className="text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0">
                                {item.icon}
                              </span>
                              <span className="text-sm truncate">{item.name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Link
              href="/dashboard/data-management"
              title={isCollapsed ? '데이터 관리' : undefined}
              className={linkRowClass(isCollapsed)}
            >
              <span className="text-zinc-500 group-hover:text-blue-400 transition-colors shrink-0">
                <Database className="w-5 h-5" />
              </span>
              {!isCollapsed && (
                <span className="text-sm font-medium truncate">데이터 관리</span>
              )}
            </Link>
          </div>

          <div className="mt-auto pt-4 border-t border-zinc-800">
            {isCollapsed ? (
              <button
                type="button"
                title={`템플릿 (${starredQueries.length})`}
                aria-label={`템플릿 ${starredQueries.length}개`}
                onClick={(e) => openFlyoutMenu('templates', e.currentTarget)}
                className="flex w-full items-center justify-center px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Star className="w-5 h-5 text-yellow-500 shrink-0" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsStarredExpanded(!isStarredExpanded)}
                  className="flex items-center justify-between w-full px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-4 h-4 text-yellow-500 shrink-0" />
                    <span className="text-sm font-medium truncate">템플릿</span>
                    <span className="text-xs text-zinc-500 shrink-0">
                      ({starredQueries.length})
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform shrink-0 ${
                      isStarredExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isStarredExpanded && starredTemplatesList()}
              </>
            )}
          </div>
        </div>
      </nav>

      {flyout && flyoutGroup && (
        <div
          ref={flyoutRef}
          className="fixed z-[100] min-w-[220px] max-w-[min(100vw-1rem,320px)] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          style={{ top: flyout.top, left: flyout.left }}
        >
          <p className="px-3 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-800">
            {flyoutGroup.name}
          </p>
          <div className="p-1">
            {flyoutGroup.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeFlyout}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white group"
              >
                <span className="text-zinc-500 group-hover:text-blue-400 transition-colors shrink-0">
                  {item.icon}
                </span>
                <span className="text-sm truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {flyout?.id === 'templates' && (
        <div
          ref={flyoutRef}
          className="fixed z-[100] w-[min(calc(100vw-1rem),18rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col"
          style={{ top: flyout.top, left: flyout.left }}
        >
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Star className="w-4 h-4 text-yellow-500 shrink-0" />
              <span className="text-sm font-medium text-white truncate">템플릿</span>
              <span className="text-xs text-zinc-500 shrink-0">
                ({starredQueries.length})
              </span>
            </div>
          </div>
          <div className="p-2 overflow-y-auto flex-1 min-h-0">
            {starredTemplatesList({ afterNavigate: closeFlyout })}
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
