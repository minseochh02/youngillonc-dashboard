export default function MainDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-8">
      {children}
    </div>
  );
}
