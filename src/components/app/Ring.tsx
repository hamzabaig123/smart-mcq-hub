type RingProps = {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
};

export function Ring({ value, size = 48, stroke = 4, color = "var(--accent)", className }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`-rotate-90 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="ring-anim"
      />
    </svg>
  );
}
