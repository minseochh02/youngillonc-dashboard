'use client';

import { useState } from 'react';
import Link from "next/link";
import { LayoutDashboard, ClipboardList, Receipt, Package, Calculator, ShoppingCart, AlertTriangle, Star, ChevronDown } from "lucide-react";
import { useStarredQueries } from '@/hooks/useStarredQueries';

const Navigation = () => {
  const { queries: starredQueries } = useStarredQueries();
  const [isStarredExpanded, setIsStarredExpanded] = useState(true);
  const navItems = [
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
    {
      name: "일일매출수금현황",
      href: "/dashboard/daily-sales",
      icon: <Receipt className="w-5 h-5" />,
    },
    {
      name: "판매현황",
      href: "/dashboard/sales-inventory",
      icon: <ShoppingCart className="w-5 h-5" />,
    },
    {
      name: "재고현황",
      href: "/dashboard/inventory",
      icon: <Package className="w-5 h-5" />,
    },
    {
      name: "일일재고파악시트",
      href: "/dashboard/daily-inventory",
      icon: <Calculator className="w-5 h-5" />,
    },
    {
      name: "사업소별 장기재고 현황",
      href: "/dashboard/long-term-inventory",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="w-64 bg-zinc-900 text-white min-h-screen p-4 flex flex-col gap-2">
      <div className="mb-8 px-2 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight">Youngil ONC</h1>
        <p className="text-xs text-zinc-400 mt-1">Management Dashboard</p>
      </div>
      
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
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
      </div>

      {/* Starred Queries Section */}
      <div className="mt-8 pt-4 border-t border-zinc-800">
        <button
          onClick={() => setIsStarredExpanded(!isStarredExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">즐겨찾기</span>
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
            {starredQueries.map((query) => (
              <Link
                key={query.id}
                href={`/dashboard?executeStarred=${query.id}`}
                className="block px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate flex-1">{query.queryName}</span>
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
              </Link>
            ))}
            {starredQueries.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-500">
                즐겨찾기한 쿼리가 없습니다
              </p>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
