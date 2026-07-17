export default function DataPreviewTable({ data }) {
  if (!data || data.length === 0) return <p style={{ color:'#334155', fontSize:'0.85rem' }}>No preview available.</p>
  const headers = Object.keys(data[0])

  return (
    <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid rgba(51,65,85,0.4)' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
        <thead>
          <tr style={{ background:'rgba(15,23,42,0.8)', borderBottom:'1px solid rgba(51,65,85,0.5)' }}>
            {headers.map(h => (
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:'0.7rem', letterSpacing:'0.05em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom:'1px solid rgba(15,23,42,0.9)', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {headers.map(h => (
                <td key={h} style={{ padding:'7px 12px', color:'#94a3b8', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }} title={String(row[h] ?? '')}>
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
