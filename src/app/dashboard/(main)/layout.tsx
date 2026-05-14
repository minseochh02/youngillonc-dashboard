import { VatIncludeProvider } from "@/contexts/VatIncludeContext";
import { UiSettingsProvider } from "@/contexts/UiSettingsContext";

export default function MainDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UiSettingsProvider>
      <VatIncludeProvider>
        <div className="p-8 min-w-0">{children}</div>
      </VatIncludeProvider>
    </UiSettingsProvider>
  );
}
