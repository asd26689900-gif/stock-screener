export default function Skeleton({ rows = 3, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div className={`sk-box ${compact ? "compact" : ""}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
