/**
 * DecisionPilot AI Logo — SVG replica of the brand logo
 * Shows the human face silhouette + bar chart + line graph + pixel particles
 */
export default function Logo({ size = 40, showText = false, textSize = '1rem' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: showText ? 10 : 0 }}>
      {/* SVG Icon */}
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dp_g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8"/>
            <stop offset="50%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor="#8b5cf6"/>
          </linearGradient>
          <linearGradient id="dp_g2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor="#a855f7"/>
          </linearGradient>
          <linearGradient id="dp_g3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#38bdf8"/>
          </linearGradient>
        </defs>
        {/* Dark circle bg */}
        <circle cx="32" cy="32" r="30" fill="#0d0d1a"/>
        {/* Outer glow ring */}
        <circle cx="32" cy="32" r="29" fill="none" stroke="url(#dp_g1)" strokeWidth="0.8" opacity="0.4"/>
        {/* Face arc (left side) */}
        <path d="M18 50 Q11 40 13 27 Q15 14 28 11 Q40 9 45 20 Q50 32 44 44 Q40 50 33 52"
          stroke="url(#dp_g1)" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.9"/>
        {/* Swish bottom */}
        <path d="M18 50 Q22 55 32 54 Q40 53 44 48"
          stroke="url(#dp_g3)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85"/>
        {/* Bar 1 */}
        <rect x="20" y="31" width="5" height="13" rx="1.5" fill="url(#dp_g2)" opacity="0.8"/>
        {/* Bar 2 */}
        <rect x="27" y="24" width="5" height="20" rx="1.5" fill="url(#dp_g2)"/>
        {/* Bar 3 */}
        <rect x="34" y="27" width="5" height="17" rx="1.5" fill="url(#dp_g2)" opacity="0.9"/>
        {/* Line graph overlay */}
        <polyline points="22,37 29,29 36,33 41,24"
          stroke="#c084fc" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="22" cy="37" r="2" fill="#c084fc"/>
        <circle cx="29" cy="29" r="2" fill="#c084fc"/>
        <circle cx="36" cy="33" r="2" fill="#c084fc"/>
        <circle cx="41" cy="24" r="2" fill="#c084fc"/>
        {/* Pixel particles (dissolving right side) */}
        <rect x="43" y="17" width="4"   height="4"   rx="0.8" fill="#38bdf8" opacity="0.95"/>
        <rect x="49" y="14" width="3"   height="3"   rx="0.6" fill="#38bdf8" opacity="0.75"/>
        <rect x="48" y="21" width="3.5" height="3.5" rx="0.7" fill="#818cf8" opacity="0.85"/>
        <rect x="53" y="18" width="2.5" height="2.5" rx="0.5" fill="#a855f7" opacity="0.65"/>
        <rect x="52" y="24" width="2"   height="2"   rx="0.4" fill="#38bdf8" opacity="0.55"/>
        <rect x="46" y="25" width="2"   height="2"   rx="0.4" fill="#6366f1" opacity="0.6"/>
        {/* Sparkle star top-right */}
        <path d="M50 11 L51.2 14.5 L55 15.5 L51.2 16.5 L50 20 L48.8 16.5 L45 15.5 L48.8 14.5 Z"
          fill="#38bdf8" opacity="0.95"/>
      </svg>

      {/* Optional text */}
      {showText && (
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:1 }}>
            <span style={{ fontWeight:900, fontSize:textSize, color:'white', letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>
              DECISION
            </span>
            <span style={{ fontWeight:900, fontSize:textSize, background:'linear-gradient(90deg,#6366f1,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'-0.02em', fontFamily:'Inter,sans-serif' }}>
              PILOT
            </span>
            <span style={{ marginLeft:4, padding:'1px 5px', border:'1.5px solid #6366f1', borderRadius:5, color:'#818cf8', fontWeight:800, fontSize:`calc(${textSize} * 0.7)`, letterSpacing:'0.05em' }}>
              AI
            </span>
          </div>
          <span style={{ color:'#475569', fontSize:`calc(${textSize} * 0.55)`, letterSpacing:'0.12em', fontWeight:500, textTransform:'uppercase', fontFamily:'Inter,sans-serif' }}>
            See · Predict · Decide · Grow
          </span>
        </div>
      )}
    </div>
  )
}
