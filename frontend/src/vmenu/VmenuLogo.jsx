export default function VmenuLogo({ size = 40 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#0f6e56" />
      <circle cx="24" cy="24" r="14" fill="#f4a825" stroke="#c62828" strokeWidth="2" />
      <circle cx="18" cy="20" r="2" fill="#c62828" />
      <circle cx="28" cy="22" r="2" fill="#c62828" />
      <circle cx="22" cy="28" r="2" fill="#c62828" />
      <circle cx="30" cy="28" r="1.5" fill="#c62828" />
      <path d="M24 8v6M24 34v6M8 24h6M34 24h6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
