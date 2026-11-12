export default function VmagnitolLogo({ size = 48 }) {
  const s = Number(size) || 48;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#FF7A00" />
      <rect x="9" y="14" width="30" height="18" rx="3" fill="#FFF8F2" />
      <rect x="12" y="17" width="18" height="12" rx="1.5" fill="#1A1208" opacity="0.85" />
      <circle cx="34" cy="23" r="2.2" fill="#1A1208" />
      <path d="M16 36h16" stroke="#FFF8F2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}