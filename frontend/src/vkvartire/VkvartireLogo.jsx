export default function VkvartireLogo({ size = 40 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="vkvaBagGrad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2a7ab8" />
          <stop offset="1" stopColor="#164e7a" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#vkvaBagGrad)" />
      <path
        d="M12 24.5L24 14l12 10.5V36a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V24.5z"
        fill="#fff"
        opacity="0.95"
      />
      <rect x="20" y="27" width="8" height="11" rx="1" fill="#2a7ab8" />
      <rect x="15.5" y="26" width="5" height="5" rx="0.6" fill="#2a7ab8" opacity="0.7" />
      <rect x="27.5" y="26" width="5" height="5" rx="0.6" fill="#2a7ab8" opacity="0.7" />
    </svg>
  );
}
