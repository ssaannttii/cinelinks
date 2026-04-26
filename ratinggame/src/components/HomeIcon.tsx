export default function HomeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "-1px", flexShrink: 0 }}
    >
      <path d="M1.5 7L7 1.5L12.5 7V13H9V9.5H5V13H1.5Z" />
    </svg>
  );
}
