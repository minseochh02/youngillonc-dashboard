import { VatIncludeProvider } from "@/contexts/VatIncludeContext";

export default function MainDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VatIncludeProvider>
      <div className="p-8 min-w-0">{children}</div>
    </VatIncludeProvider>
  );
}
