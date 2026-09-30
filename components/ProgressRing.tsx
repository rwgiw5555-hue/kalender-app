// Fortschrittsring „x von y erledigt“
export default function ProgressRing({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const part = total === 0 ? 1 : done / total
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} von ${total} erledigt`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--app-line)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--app-accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * part} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.3s ease' }}
      />
    </svg>
  )
}
