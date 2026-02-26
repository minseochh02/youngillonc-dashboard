import Link from "next/link";
import { LayoutDashboard, ClipboardList, Receipt } from "lucide-react";

const Navigation = () => {
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
    </nav>
  );
};

export default Navigation;
