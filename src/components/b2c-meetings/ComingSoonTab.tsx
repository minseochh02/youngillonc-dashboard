interface ComingSoonTabProps {
  label: string;
}

export default function ComingSoonTab({ label }: ComingSoonTabProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
      <div className="text-center text-zinc-500 dark:text-zinc-400">
        <p className="text-lg font-medium mb-2">{label}</p>
        <p className="text-sm">컨텐츠가 추가될 예정입니다</p>
      </div>
    </div>
  );
}
