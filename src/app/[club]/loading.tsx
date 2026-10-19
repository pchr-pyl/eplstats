export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-elevated" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}
