import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Send, Loader2, User, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import axios from 'axios'

const AGENT_URL = 'http://localhost:7000'

// ── Chatbot logo SVG — robot in speech bubble (blue-to-green gradient) ────────
function RobotLogo({ size = 28 }) {
  const id = 'cbg' + size
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`${id}bg`} cx="45%" cy="50%" r="55%">
          <stop offset="0%"   stopColor="#1a6fd4"/>
          <stop offset="100%" stopColor="#3ecf2c"/>
        </radialGradient>
        <radialGradient id={`${id}inner`} cx="50%" cy="40%" r="50%">
          <stop offset="0%"   stopColor="#2a85e8"/>
          <stop offset="100%" stopColor="#1250a8"/>
        </radialGradient>
        <filter id={`${id}sh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Outer speech bubble — blue-to-green */}
      <ellipse cx="50" cy="46" rx="44" ry="34" fill={`url(#${id}bg)`} filter={`url(#${id}sh)`}/>
      {/* Speech bubble tail */}
      <polygon points="30,76 22,90 48,76" fill="#2ecb1a"/>
      {/* Inner dark speech bubble ring */}
      <ellipse cx="50" cy="46" rx="38" ry="28" fill={`url(#${id}inner)`} opacity="0.85"/>

      {/* Antenna stem */}
      <line x1="50" y1="20" x2="50" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Antenna ball */}
      <circle cx="50" cy="17" r="4" fill="white" opacity="0.95"/>

      {/* Robot head — white rounded rect */}
      <rect x="30" y="28" width="40" height="30" rx="10" fill="white" opacity="0.97"/>
      {/* Robot visor / face panel */}
      <rect x="33" y="31" width="34" height="22" rx="7" fill="#0d1a2e"/>

      {/* Eyes — blue left, green right */}
      <circle cx="43" cy="42" r="6" fill="#2a85e8"/>
      <circle cx="57" cy="42" r="6" fill="#3ecf2c"/>
      {/* Eye shine */}
      <circle cx="45" cy="40" r="2" fill="white" opacity="0.7"/>
      <circle cx="59" cy="40" r="2" fill="white" opacity="0.7"/>

      {/* Smile */}
      <path d="M43 51 Q50 56 57 51" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>

      {/* Small speech bubbles left (blue) */}
      <rect x="10" y="26" width="16" height="10" rx="5" fill="#2a85e8" opacity="0.9"/>
      <circle cx="13" cy="31" r="1.5" fill="white"/>
      <circle cx="18" cy="31" r="1.5" fill="white"/>
      <circle cx="23" cy="31" r="1.5" fill="white"/>
      <polygon points="14,36 11,40 20,36" fill="#2a85e8" opacity="0.9"/>

      {/* Small speech bubbles right (green) */}
      <rect x="74" y="24" width="16" height="10" rx="5" fill="#3ecf2c" opacity="0.9"/>
      <circle cx="77" cy="29" r="1.5" fill="white"/>
      <circle cx="82" cy="29" r="1.5" fill="white"/>
      <circle cx="87" cy="29" r="1.5" fill="white"/>
      <polygon points="86,34 89,38 80,34" fill="#3ecf2c" opacity="0.9"/>

      {/* Sparkle stars */}
      <path d="M18 46 L19.5 43 L21 46 L24 47.5 L21 49 L19.5 52 L18 49 L15 47.5 Z" fill="white" opacity="0.85"/>
      <path d="M76 44 L77 42 L78 44 L80 45 L78 46 L77 48 L76 46 L74 45 Z" fill="white" opacity="0.85"/>

      {/* Dot indicators bottom right */}
      <circle cx="68" cy="62" r="3" fill="#2a85e8"/>
      <circle cx="74" cy="65" r="3" fill="#3ecf2c"/>
      <circle cx="80" cy="62" r="3" fill="#f5a623"/>
    </svg>
  )
}

// ── Markdown renderer ──────────────────────────────────────────────────────
function MdContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({children}) => <h1 style={{color:'#e2e8f0',fontSize:'1rem',fontWeight:800,margin:'8px 0 4px',borderBottom:'1px solid rgba(99,102,241,0.3)',paddingBottom:4}}>{children}</h1>,
        h2: ({children}) => <h2 style={{color:'#c7d2fe',fontSize:'0.9rem',fontWeight:700,margin:'8px 0 4px'}}>{children}</h2>,
        h3: ({children}) => <h3 style={{color:'#a5b4fc',fontSize:'0.84rem',fontWeight:700,margin:'6px 0 3px'}}>{children}</h3>,
        p:  ({children}) => <p  style={{color:'#cbd5e1',fontSize:'0.82rem',lineHeight:1.7,margin:'4px 0'}}>{children}</p>,
        strong: ({children}) => <strong style={{color:'white',fontWeight:700}}>{children}</strong>,
        em:     ({children}) => <em style={{color:'#93c5fd',fontStyle:'italic'}}>{children}</em>,
        ul: ({children}) => <ul style={{paddingLeft:16,margin:'4px 0'}}>{children}</ul>,
        ol: ({children}) => <ol style={{paddingLeft:16,margin:'4px 0'}}>{children}</ol>,
        li: ({children}) => <li style={{color:'#cbd5e1',fontSize:'0.82rem',lineHeight:1.7,marginBottom:2}}>{children}</li>,
        table: ({children}) => (
          <div style={{overflowX:'auto',margin:'8px 0'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:'0.78rem'}}>{children}</table>
          </div>
        ),
        thead: ({children}) => <thead style={{background:'rgba(99,102,241,0.2)'}}>{children}</thead>,
        th: ({children}) => <th style={{color:'#a5b4fc',padding:'6px 10px',textAlign:'left',borderBottom:'1px solid rgba(99,102,241,0.3)',fontWeight:700,fontSize:'0.76rem'}}>{children}</th>,
        td: ({children}) => <td style={{color:'#cbd5e1',padding:'5px 10px',borderBottom:'1px solid rgba(51,65,85,0.4)',fontSize:'0.78rem'}}>{children}</td>,
        code: ({inline, children}) => inline
          ? <code style={{background:'rgba(99,102,241,0.15)',color:'#a5b4fc',padding:'1px 5px',borderRadius:4,fontSize:'0.78rem',fontFamily:'monospace'}}>{children}</code>
          : <pre style={{background:'rgba(15,23,42,0.8)',border:'1px solid rgba(51,65,85,0.4)',borderRadius:8,padding:'10px 14px',overflowX:'auto',margin:'6px 0'}}><code style={{color:'#94a3b8',fontSize:'0.76rem',fontFamily:'monospace'}}>{children}</code></pre>,
        blockquote: ({children}) => <blockquote style={{borderLeft:'3px solid #6366f1',paddingLeft:10,margin:'6px 0',color:'#94a3b8',fontStyle:'italic'}}>{children}</blockquote>,
        hr: () => <hr style={{border:'none',borderTop:'1px solid rgba(51,65,85,0.4)',margin:'8px 0'}}/>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function TypingDots() {
  return (
    <div style={{display:'flex',gap:4,padding:'10px 14px',background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.15)',borderRadius:'16px 16px 16px 3px',width:'fit-content',marginBottom:10,alignItems:'center'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#818cf8',animation:`chatDot 1.4s ease-in-out ${i*0.2}s infinite`}}/>
      ))}
      <span style={{color:'#475569',fontSize:'0.67rem',marginLeft:5,fontStyle:'italic'}}>Analysing your data…</span>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const [expanded, setExpanded] = useState(true)
  const isLong = !isUser && msg.content.length > 800

  return (
    <div style={{display:'flex',flexDirection:isUser?'row-reverse':'row',gap:8,marginBottom:14,alignItems:'flex-start'}}>
      <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1250a8,#2a9d1a)',border:'none',overflow:'hidden',marginTop:2,padding:1}}>
        {isUser ? <User size={13} color="#818cf8"/> : <RobotLogo size={26}/>}
      </div>
      <div style={{maxWidth:'85%'}}>
        <div style={{padding:'10px 14px',background:isUser?'linear-gradient(135deg,#6366f1,#7c3aed)':'rgba(10,16,32,0.97)',border:isUser?'none':'1px solid rgba(51,65,85,0.45)',borderRadius:isUser?'16px 16px 3px 16px':'16px 16px 16px 3px',boxShadow:isUser?'0 3px 14px rgba(99,102,241,0.3)':'0 2px 8px rgba(0,0,0,0.3)'}}>
          {isUser
            ? <p style={{color:'white',fontSize:'0.83rem',lineHeight:1.65,margin:0,whiteSpace:'pre-wrap'}}>{msg.content}</p>
            : <div style={{overflow:'hidden',maxHeight:expanded?'none':'200px'}}><MdContent content={msg.content}/></div>
          }
          {isLong && (
            <button onClick={()=>setExpanded(e=>!e)}
              style={{display:'flex',alignItems:'center',gap:4,marginTop:6,background:'none',border:'none',color:'#6366f1',fontSize:'0.72rem',cursor:'pointer',padding:0}}>
              {expanded ? <><ChevronUp size={12}/> Show less</> : <><ChevronDown size={12}/> Show more</>}
            </button>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,marginTop:3,justifyContent:isUser?'flex-end':'flex-start'}}>
          <span style={{color:'#1e293b',fontSize:'0.58rem'}}>{msg.time}</span>
          {!isUser && msg.source==='openai' && (
            <span style={{padding:'1px 6px',borderRadius:99,fontSize:'0.57rem',fontWeight:700,background:'rgba(16,163,127,0.1)',border:'1px solid rgba(16,163,127,0.25)',color:'#34d399'}}>✨ GPT-4o</span>
          )}
          {!isUser && msg.source==='gemini' && (
            <span style={{padding:'1px 6px',borderRadius:99,fontSize:'0.57rem',fontWeight:700,background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.25)',color:'#c4b5fd'}}>✨ Gemini AI</span>
          )}
          {!isUser && msg.source==='local' && (
            <span style={{padding:'1px 6px',borderRadius:99,fontSize:'0.57rem',fontWeight:700,background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.2)',color:'#6ee7b7'}}>⚡ Local</span>
          )}
        </div>
      </div>
    </div>
  )
}

const STYLES = `
@keyframes chatDot{0%,80%,100%{transform:scale(0.65);opacity:0.45}40%{transform:scale(1.2);opacity:1}}
@keyframes chatFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes chatIn{from{opacity:0;transform:translateY(22px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes spinA{to{transform:rotate(360deg)}}
.chat-scroll::-webkit-scrollbar{width:3px}
.chat-scroll::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:99px}
.chip-btn{padding:4px 10px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:99px;color:#64748b;font-size:0.67rem;cursor:pointer;transition:all 0.18s;white-space:nowrap}
.chip-btn:hover{background:rgba(99,102,241,0.2);color:white;border-color:rgba(99,102,241,0.45)}
`

export default function ChatbotWidget({ uploadData, analysisData }) {
  const [open,    setOpen]    = useState(false)
  const [msgs,    setMsgs]    = useState([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Agent session id comes from uploadData (auto-forwarded during main upload)
  const agentSessionId = uploadData?.agentSessionId || null
  const hasAgent = !!agentSessionId

  function now() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }

  // Build greeting whenever uploadData changes
  useEffect(() => {
    const cols  = analysisData?.aggregateStats?.columns || []
    const num   = cols.filter(c=>c.type==='numeric').map(c=>c.name)
    const cat   = cols.filter(c=>c.type==='categorical').map(c=>c.name)
    const dat   = cols.filter(c=>c.type==='date').map(c=>c.name)

    let greeting
    if (uploadData?.fileName) {
      greeting = `## 👋 Hi! I'm your AI Data Analyst\n\n`
      greeting += `**Dataset loaded:** ${uploadData.fileName} · ${uploadData.rowCount?.toLocaleString()} records\n\n`
      if (num.length)  greeting += `**Metrics:** ${num.slice(0,5).join(', ')}\n`
      if (cat.length)  greeting += `**Categories:** ${cat.slice(0,4).join(', ')}\n`
      if (dat.length)  greeting += `**Date column:** ${dat[0]}\n`
      greeting += `\n${hasAgent
        ? '✅ **AI Agent ready** — I can answer any question about your data!'
        : '⚡ **Local engine active** — Ask me anything!'
      }`
    } else {
      greeting = `## 👋 Hi! I'm your AI Data Analyst\n\nUpload a dataset on the main page and I'll automatically analyse it for you!\n\nI can answer any question about your data using **Gemini AI + pandas** analysis.`
    }

    setMsgs([{ role:'assistant', content:greeting, time:now(), source: hasAgent ? 'gemini' : 'local' }])
  }, [uploadData?.sessionId])

  useEffect(() => {
    if (open) setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}), 80)
  }, [msgs, open])

  // Dynamic chips from actual columns
  const chips = useCallback(() => {
    const cols = analysisData?.aggregateStats?.columns || []
    const num  = cols.filter(c=>c.type==='numeric').map(c=>c.name)
    const cat  = cols.filter(c=>c.type==='categorical').map(c=>c.name)
    const dat  = cols.filter(c=>c.type==='date').map(c=>c.name)
    if (!num.length && !cat.length) return []
    const c = ['Give me a complete summary']
    if (cat[0]&&num[0]) c.push(`Which ${cat[0]} has the highest ${num[0]}?`)
    if (num[0]) c.push(`Total ${num[0]}`)
    if (cat[0]&&num[0]) c.push(`Compare all ${cat[0]}s by ${num[0]}`)
    if (dat[0]) c.push('Show trend over time')
    c.push('Any anomalies or outliers?')
    c.push('Give me business recommendations')
    return c.slice(0,6)
  }, [analysisData])()

  const send = async (text) => {
    const q = (text||input).trim()
    if (!q || loading) return
    setInput('')
    setMsgs(prev=>[...prev, {role:'user',content:q,time:now()}])
    setLoading(true)

    try {
      const history = msgs.slice(-10).map(m=>({role:m.role,content:m.content.slice(0,400)}))

      // ── Route 1: Python AI Agent (preferred) ───────────────────────────
      if (hasAgent) {
        const { data } = await axios.post(`${AGENT_URL}/agent/ask`, {
          session_id: agentSessionId,
          message: q,
          conversation_history: history,
        }, { timeout: 45000 })
        setMsgs(prev=>[...prev, {
          role:'assistant',
          content: data.reply || 'No response generated.',
          time: now(),
          source: 'gemini',
          intent: data.intent,
        }])
        return
      }

      // ── Route 2: Node.js local engine (fallback if agent unavailable) ──
      const { data } = await axios.post('/api/chatbot', {
        message: q,
        sessionId: uploadData?.sessionId || null,
        conversationHistory: history,
      }, { timeout: 30000 })
      setMsgs(prev=>[...prev, {
        role:'assistant',
        content: data.reply || 'No response generated.',
        time: now(),
        source: data.source || 'local',
      }])

    } catch(e) {
      const msg = e?.code==='ECONNABORTED'
        ? "⏱️ The analysis took too long. Please try a simpler question."
        : e?.response?.data?.detail
        ? `❌ ${e.response.data.detail}`
        : "❌ Something went wrong. Please try again."
      setMsgs(prev=>[...prev,{role:'assistant',content:msg,time:now(),source:'error'}])
    } finally {
      setLoading(false)
      setTimeout(()=>inputRef.current?.focus(),100)
    }
  }

  const showChips = msgs.length <= 1 && !loading && chips.length > 0

  return (
    <>
      <style>{STYLES}</style>

      {/* Floating button */}
      {!open && (
        <button data-chatbtn onClick={()=>setOpen(true)} title="AI Data Analyst"
          style={{position:'fixed',bottom:20,right:20,zIndex:9999,
            width:'clamp(48px,13vw,62px)',height:'clamp(48px,13vw,62px)',borderRadius:'50%',
            background:'linear-gradient(135deg,#1250a8,#2a9d1a)',
            border:'2px solid rgba(62,207,44,0.4)',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 8px 28px rgba(26,111,212,0.5)',
            animation:'chatFloat 3s ease-in-out infinite',transition:'all 0.25s',padding:2}}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 12px 40px rgba(26,111,212,0.7)';e.currentTarget.style.animation='none';e.currentTarget.style.transform='scale(1.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 8px 28px rgba(26,111,212,0.5)';e.currentTarget.style.animation='chatFloat 3s ease-in-out infinite';e.currentTarget.style.transform='scale(1)'}}>
          <RobotLogo size={Math.min(50, window.innerWidth * 0.1)}/>
          <span style={{position:'absolute',top:2,right:2,width:12,height:12,borderRadius:'50%',background: uploadData ? '#34d399' : '#fbbf24',border:'2px solid #060914',boxShadow:`0 0 6px ${uploadData?'#34d399':'#fbbf24'}`}}/>
        </button>
      )}

      {/* Chat window — responsive: full screen on mobile, floating on desktop */}
      {open && (
        <div data-chatwidget
          style={{
            position:'fixed',
            bottom: window.innerWidth<=480 ? 0 : 20,
            right:  window.innerWidth<=480 ? 0 : 20,
            left:   window.innerWidth<=480 ? 0 : 'auto',
            width:  window.innerWidth<=480 ? '100%' : 'min(440px, 96vw)',
            height: window.innerWidth<=480 ? '100dvh' : 'min(660px, 92vh)',
            zIndex:9999,
            borderRadius: window.innerWidth<=480 ? '0' : '22px',
            display:'flex',flexDirection:'column',overflow:'hidden',
            background:'#060914',border:'1px solid rgba(99,102,241,0.28)',
            boxShadow:'0 24px 80px rgba(0,0,0,0.75)',
            animation:'chatIn 0.28s cubic-bezier(0.34,1.56,0.64,1)'
          }}>

          {/* Header */}
          <div style={{padding:'13px 16px',background:'linear-gradient(135deg,rgba(42,112,144,0.15),rgba(99,102,241,0.08))',borderBottom:'1px solid rgba(99,102,241,0.18)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <div style={{width:44,height:44,borderRadius:13,background:'linear-gradient(135deg,#1250a8,#2a9d1a)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(26,111,212,0.45)',flexShrink:0,padding:2}}>
              <RobotLogo size={38}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:'white',fontWeight:700,fontSize:'0.9rem',margin:0}}>AI Data Analyst</p>
              <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
                <span style={{width:6,height:6,borderRadius:'50%',background: hasAgent ? '#34d399' : '#fbbf24',display:'inline-block',boxShadow:`0 0 5px ${hasAgent?'#34d399':'#fbbf24'}`}}/>
                <span style={{color: hasAgent ? '#34d399' : '#fbbf24',fontSize:'0.63rem',fontWeight:600}}>
                  {hasAgent ? `GPT-4o · ${uploadData?.fileName}` : uploadData ? 'Local engine active' : 'Upload a file to start'}
                </span>
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>{ setMsgs([{role:'assistant',content:'Chat cleared. Ask me anything!',time:now(),source:'local'}]) }}
                title="Clear chat" style={{width:28,height:28,borderRadius:8,background:'rgba(51,65,85,0.35)',border:'1px solid rgba(51,65,85,0.45)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#475569',transition:'all 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.color='#94a3b8'}} onMouseLeave={e=>{e.currentTarget.style.color='#475569'}}>
                <RotateCcw size={12}/>
              </button>
              <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:8,background:'rgba(51,65,85,0.35)',border:'1px solid rgba(51,65,85,0.45)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#475569',transition:'all 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.15)';e.currentTarget.style.color='#f87171'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(51,65,85,0.35)';e.currentTarget.style.color='#475569'}}>
                <X size={13}/>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-scroll" style={{flex:1,overflowY:'auto',padding:'14px 12px',display:'flex',flexDirection:'column'}}>
            {msgs.map((msg,i)=><Message key={i} msg={msg}/>)}
            {loading && <TypingDots/>}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestion chips */}
          {showChips && (
            <div style={{padding:'7px 11px 5px',borderTop:'1px solid rgba(51,65,85,0.2)',background:'rgba(6,9,20,0.7)',flexShrink:0}}>
              <p style={{color:'#334155',fontSize:'0.6rem',fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Quick questions</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {chips.map((c,i)=><button key={i} className="chip-btn" onClick={()=>send(c)}>{c}</button>)}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{padding:'10px 11px',borderTop:'1px solid rgba(51,65,85,0.25)',display:'flex',gap:7,flexShrink:0,background:'#060914'}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
              placeholder={uploadData ? 'Ask anything about your data…' : 'Upload a file on the main page first…'}
              disabled={loading || !uploadData}
              style={{flex:1,background:'rgba(13,19,38,0.95)',border:`1px solid ${input?'rgba(99,102,241,0.5)':'rgba(51,65,85,0.4)'}`,borderRadius:11,padding:'9px 13px',color:'white',fontSize:'0.81rem',outline:'none',transition:'all 0.2s',boxShadow:input?'0 0 0 3px rgba(99,102,241,0.1)':'none',opacity: uploadData ? 1 : 0.5}}/>
            <button onClick={()=>send()} disabled={!input.trim()||loading||!uploadData}
              style={{width:38,height:38,borderRadius:10,border:'none',cursor:input.trim()&&!loading&&uploadData?'pointer':'not-allowed',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',background:input.trim()&&!loading&&uploadData?'linear-gradient(135deg,#6366f1,#8b5cf6)':'rgba(30,41,59,0.5)',boxShadow:input.trim()&&!loading&&uploadData?'0 3px 12px rgba(99,102,241,0.4)':'none'}}>
              {loading ? <Loader2 size={15} color="#34d399" style={{animation:'spinA 1s linear infinite'}}/> : <Send size={14} color={input.trim()&&!loading&&uploadData?'white':'#334155'}/>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
