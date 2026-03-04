export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-muted animate-spin border-t-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
