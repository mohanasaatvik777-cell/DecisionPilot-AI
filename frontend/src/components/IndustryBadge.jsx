const THEMES = {
  retail:        { color:'#818cf8', bg:'rgba(129,140,248,0.12)', border:'rgba(129,140,248,0.25)' },
  restaurant:    { color:'#fb923c', bg:'rgba(251,146,60,0.12)',  border:'rgba(251,146,60,0.25)'  },
  healthcare:    { color:'#34d399', bg:'rgba(52,211,153,0.12)',  border:'rgba(52,211,153,0.25)'  },
  finance:       { color:'#6ee7b7', bg:'rgba(110,231,183,0.12)', border:'rgba(110,231,183,0.25)' },
  manufacturing: { color:'#94a3b8', bg:'rgba(148,163,184,0.1)',  border:'rgba(148,163,184,0.2)'  },
  education:     { color:'#c4b5fd', bg:'rgba(196,181,253,0.12)', border:'rgba(196,181,253,0.25)' },
  marketing:     { color:'#f9a8d4', bg:'rgba(249,168,212,0.12)', border:'rgba(249,168,212,0.25)' },
  logistics:     { color:'#67e8f9', bg:'rgba(103,232,249,0.12)', border:'rgba(103,232,249,0.25)' },
  general:       { color:'#64748b', bg:'rgba(100,116,139,0.1)',  border:'rgba(100,116,139,0.2)'  },
}

export default function IndustryBadge({ industry }) {
  const label = industry || 'general'
  const t = THEMES[label] || THEMES.general
  return (
    <span style={{
      fontSize:'0.7rem', fontWeight:700, padding:'3px 10px', borderRadius:99,
      background:t.bg, border:`1px solid ${t.border}`, color:t.color,
      textTransform:'uppercase', letterSpacing:'0.06em'
    }}>
      {label}
    </span>
  )
}
