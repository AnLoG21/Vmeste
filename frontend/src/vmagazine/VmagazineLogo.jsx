export default function VmagazineLogo({ size = 40 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="vmagBagGrad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7b5ea7" />
          <stop offset="1" stopColor="#4f3578" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#vmagBagGrad)" />
      <path
        d="M16 18h16l-1.2 14.2a2.4 2.4 0 0 1-2.4 2.2h-8.8a2.4 2.4 0 0 1-2.4-2.2L16 18z"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M18.5 18.2c0-3.1 2.4-5.6 5.5-5.6s5.5 2.5 5.5 5.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="33.5" cy="33.5" r="7.2" fill="#ff8a00" />
      <path
        d="M30.6 33.6l1.7 1.7 4.2-4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
