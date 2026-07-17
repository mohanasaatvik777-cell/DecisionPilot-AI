import { useState } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'

const FILTER_OPTIONS = {
  date:         { label: 'Date Range',    options: ['All Time','Today','Last 7 Days','Last 30 Days','Last 90 Days','This Year'] },
  region:       { label: 'Region',        options: ['All Regions','North','South','East','West','Central'] },
  store:        { label: 'Store',         options: ['All Stores','Store A','Store B','Store C','Online'] },
  category:     { label: 'Category',      options: ['All Categories','Electronics','Clothing','Food','Beauty','Sports'] },
  product:      { label: 'Product',       options: ['All Products','Top 10','Top 25','Custom'] },
  customerType: { label: 'Customer Type', options: ['All','New','Returning','VIP','Wholesale'] },
  branch:       { label: 'Branch',        options: ['All Branches','Main Branch','North Branch','South Branch'] },
  waiter:       { label: 'Staff',         options: ['All Staff','Staff A','Staff B','Staff C'] },
  foodCategory: { label: 'Food Category', options: ['All Items','Starters','Mains','Desserts','Drinks','Specials'] },
  paymentMethod:{ label: 'Payment',       options: ['All Methods','Cash','Card','UPI','Online'] },
  department:   { label: 'Department',    options: ['All Depts','Emergency','Cardiology','Orthopedics','Pediatrics','ICU'] },
  doctor:       { label: 'Doctor',        options: ['All Doctors','Dr. Smith','Dr. Jones','Dr. Patel'] },
  disease:      { label: 'Condition',     options: ['All Conditions','Cardiac','Respiratory','Orthopedic','Neurological'] },
  gender:       { label: 'Gender',        options: ['All','Male','Female','Other'] },
  age:          { label: 'Age Group',     options: ['All Ages','0-18','19-35','36-55','55+'] },
  plant:        { label: 'Plant',         options: ['All Plants','Plant A','Plant B','Plant C'] },
  machine:      { label: 'Machine',       options: ['All Machines','Line 1','Line 2','Line 3'] },
  shift:        { label: 'Shift',         options: ['All Shifts','Morning','Afternoon','Night'] },
  operator:     { label: 'Operator',      options: ['All Operators','Operator A','Operator B'] },
  class:        { label: 'Class',         options: ['All Classes','Class 1','Class 2','Class 3','Class 4','Class 5'] },
  section:      { label: 'Section',       options: ['All Sections','Section A','Section B','Section C'] },
  teacher:      { label: 'Teacher',       options: ['All Teachers','Mr. Smith','Ms. Jones','Mr. Patel'] },
  subject:      { label: 'Subject',       options: ['All Subjects','Math','Science','English','History','CS'] },
  semester:     { label: 'Semester',      options: ['All','Semester 1','Semester 2'] },
  campaign:     { label: 'Campaign',      options: ['All Campaigns','Summer Sale','Brand Awareness','Product Launch','Retargeting'] },
  platform:     { label: 'Platform',      options: ['All Platforms','Google','Facebook','Instagram','Email','LinkedIn'] },
  expenseType:  { label: 'Expense Type',  options: ['All','Operations','Marketing','HR','IT','Facilities'] },
  revenueSource:{ label: 'Revenue Source',options: ['All Sources','Products','Services','Subscriptions','Licensing'] },
  project:      { label: 'Project',       options: ['All Projects','Project Alpha','Project Beta','Project Gamma'] },
}

export default function DashboardFilters({ filterKeys, primaryColor, onFiltersChange }) {
  const [filters, setFilters] = useState({})
  const [expanded, setExpanded] = useState(false)
  const [openKey, setOpenKey] = useState(null)
  const c = primaryColor || '#6366f1'

  const activeCount = Object.values(filters).filter(v => v && !v.startsWith('All') && v !== 'All Time').length

  const setFilter = (key, val) => {
    const next = { ...filters, [key]: val }
    setFilters(next)
    onFiltersChange?.(next)
    setOpenKey(null)
  }

  const resetAll = () => { setFilters({}); onFiltersChange?.({}) }

  return (
    <div style={{ marginBottom: 20 }}>
      <style>{`
        @keyframes filterDropIn{from{opacity:0;transform:translateY(-6px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes filterFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      `}</style>
      {/* Filter toggle bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 14 : 0 }}>
        <button
          onClick={() => setExpanded(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 10,
            background: expanded ? `${c}18` : 'rgba(15,23,42,0.6)',
            border: `1px solid ${expanded ? c+'50' : 'rgba(51,65,85,0.4)'}`,
            color: expanded ? 'white' : '#64748b',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: expanded ? `0 4px 16px ${c}20` : 'none',
          }}
        >
          <Filter size={14} color={expanded ? c : '#64748b'} />
          Filters
          {activeCount > 0 && (
            <span style={{ background: `linear-gradient(135deg,${c},${c}cc)`, color: 'white', borderRadius: 99, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700, boxShadow: `0 2px 8px ${c}40` }}>
              {activeCount}
            </span>
          )}
          <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
        </button>

        {/* Active filter chips */}
        <div className="filter-chips" style={{ display:'flex', flexWrap:'wrap', gap:6, flex:1 }}>
          {Object.entries(filters).map(([key, val]) => {
            if (!val || val.startsWith('All') || val === 'All Time') return null
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: `${c}15`, border: `1px solid ${c}40`, borderRadius: 99, fontSize: '0.72rem', color: 'white', animation: 'filterFadeIn 0.2s ease-out' }}>
                <span style={{ color: '#94a3b8' }}>{FILTER_OPTIONS[key]?.label}:</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
                <button onClick={() => setFilter(key, '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0, marginLeft: 2, transition: 'color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='#64748b'}>
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        {activeCount > 0 && (
          <button onClick={resetAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.75rem', textDecoration: 'underline', transition: 'color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='#475569'}>
            Clear all
          </button>
        )}
      </div>

      {/* Filter dropdowns — custom animated */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '16px', background: 'rgba(8,12,26,0.8)', border: `1px solid rgba(51,65,85,0.35)`, borderRadius: 14, backdropFilter: 'blur(12px)', animation: 'filterFadeIn 0.22s ease-out' }}>
          {filterKeys.map(key => {
            const opt = FILTER_OPTIONS[key]
            if (!opt) return null
            const isOpen = openKey === key
            const val = filters[key] || ''
            const isActive = val && !val.startsWith('All') && val !== 'All Time'
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130, position: 'relative' }}
                onBlur={()=>setTimeout(()=>{ if(openKey===key) setOpenKey(null) },150)}>
                <label style={{ color: isActive ? c : '#475569', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.2s' }}>{opt.label}</label>
                {/* Trigger */}
                <button type="button" onClick={()=>setOpenKey(isOpen?null:key)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding: '7px 10px', borderRadius: 9, cursor: 'pointer', outline: 'none',
                    background: isOpen ? `rgba(8,12,26,0.98)` : `rgba(15,23,42,0.7)`,
                    border: `1px solid ${isActive ? c+'60' : isOpen ? c+'30' : 'rgba(51,65,85,0.5)'}`,
                    color: isActive ? 'white' : '#64748b',
                    fontSize: '0.78rem', fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.2s',
                    boxShadow: isOpen ? `0 0 0 2px ${c}20` : 'none',
                    minWidth: 120,
                  }}>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:90}}>{val || opt.options[0]}</span>
                  <ChevronDown size={10} color={isActive ? c : '#475569'} style={{ transition:'transform 0.2s', transform:isOpen?'rotate(180deg)':'none', flexShrink:0, marginLeft:4 }}/>
                </button>
                {/* Dropdown */}
                {isOpen && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:999, minWidth:150,
                    background:'rgba(8,12,26,0.99)', border:`1px solid ${c}35`, borderRadius:10,
                    boxShadow:`0 12px 40px rgba(0,0,0,0.6)`, overflow:'hidden',
                    animation:'filterDropIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    {opt.options.map((o,i)=>{
                      const sel = val===o || (!val && i===0)
                      return (
                        <button key={o} type="button" onClick={()=>setFilter(key,o)}
                          style={{ width:'100%', textAlign:'left', padding:'8px 12px', border:'none', cursor:'pointer',
                            background: sel ? `${c}20` : 'transparent', color: sel?'white':'#94a3b8',
                            fontSize:'0.78rem', fontWeight:sel?700:400, transition:'all 0.12s',
                            borderBottom: i<opt.options.length-1?'1px solid rgba(51,65,85,0.15)':'none',
                            display:'flex', alignItems:'center', justifyContent:'space-between' }}
                          onMouseEnter={e=>{if(!sel){e.currentTarget.style.background=`${c}12`;e.currentTarget.style.color='white'}}}
                          onMouseLeave={e=>{if(!sel){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94a3b8'}}}>
                          {o}
                          {sel && <span style={{width:6,height:6,borderRadius:'50%',background:c,display:'inline-block'}}/>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
