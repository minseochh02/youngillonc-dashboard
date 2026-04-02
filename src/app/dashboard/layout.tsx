import Navigation from "@/components/Navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Navigation />
      <main className="flex-1 min-w-0">
          {children}
      </main>
    </div>
  );
}
