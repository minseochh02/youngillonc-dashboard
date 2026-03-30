import { VatIncludeProvider } from "@/contexts/VatIncludeContext";

export default function MainDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VatIncludeProvider>
      <div className="p-8">{children}</div>
    </VatIncludeProvider>
  );
}
