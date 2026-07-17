import { useState } from 'react'
import { INDUSTRY_CONFIGS } from '../config/industryConfigs'

const INDUSTRIES = Object.entries(INDUSTRY_CONFIGS).filter(([k]) => k !== 'general')

export default function IndustrySelector({ selected, onChange }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>
        Select Your Industry — Dashboard Adapts Instantly
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }} className="industry-grid">
        {INDUSTRIES.map(([key, cfg]) => {
          const isSelected = selected === key
          const isHovered  = hovered === key
          const c1 = cfg.color1
          const c2 = cfg.color2
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              className="industry-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 10px',
                borderRadius: 16,
                border: isSelected ? `2px solid ${c1}` : `1px solid ${isHovered ? c1+'60' : 'rgba(51,65,85,0.5)'}`,
                background: isSelected
                  ? `linear-gradient(135deg, ${c1}20, ${c2}10)`
                  : isHovered ? `${c1}0a` : 'rgba(15,23,42,0.5)',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isSelected ? 'scale(1.04)' : isHovered ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? `0 8px 24px ${c1}30, 0 0 0 1px ${c1}20` : 'none',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Glow top bar */}
              {isSelected && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
              )}
              <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{cfg.emoji}</span>
              <span style={{
                fontSize: '0.72rem', fontWeight: isSelected ? 700 : 500,
                color: isSelected ? 'white' : '#64748b',
                textAlign: 'center', lineHeight: 1.3,
              }}>
                {cfg.label.replace(' Analytics', '').replace(' Dashboard', '')}
              </span>
              {isSelected && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c1, boxShadow: `0 0 8px ${c1}` }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
