export default function LoadingSpinner({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="2.5" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
