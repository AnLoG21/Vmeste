export default function VefireLogo({ size = 48 }) {
  const s = Number(size) || 48;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#1a1d24" />
      <rect x="8" y="12" width="32" height="20" rx="3" stroke="#FF7A00" strokeWidth="2" />
      <path d="M18 32h12" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 18.5v7l7-3.5-7-3.5z" fill="#FF7A00" />
    </svg>
  );
}
