export default function VsayteLogo({ size = 40 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="vsayteGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A00" />
          <stop offset="1" stopColor="#c45a00" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vsayteGrad)" />
      <rect x="12" y="14" width="24" height="18" rx="3" fill="#fff" opacity="0.95" />
      <rect x="15" y="18" width="10" height="2.5" rx="1" fill="#FF7A00" />
      <rect x="15" y="23" width="18" height="2" rx="1" fill="#FF7A00" opacity="0.55" />
      <rect x="15" y="27" width="14" height="2" rx="1" fill="#FF7A00" opacity="0.35" />
      <circle cx="34" cy="34" r="7" fill="#1a1a1a" />
      <path d="M31.5 34h5M34 31.5v5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
