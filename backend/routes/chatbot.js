/**
 * AI Data Analyst Chatbot — Fully Dynamic Architecture
 *
 * Works for ANY uploaded CSV. Zero hardcoded column names.
 * Backend computes ALL statistics. LLM only explains results.
 *
 * Pipeline:
 *  1. Parse question → detect operation, column, filters, grouping
 *  2. Apply filters to rows
 *  3. Compute result (max/min/avg/median/mode/count/std/frequency/groupBy)
 *  4. Format markdown response
 *  5. Optionally use Gemini to enhance explanation
 */
const express = require('express')
const router  = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const toNum = v => { const n = parseFloat(String(v).replace(/[$,%\s]/g,'')); return isNaN(n)?null:n }

function median(arr) {
  const s = [...arr].sort((a,b)=>a-b)
  const m = Math.floor(s.length/2)
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2
}

function mode(arr) {
  const freq = {}
  arr.forEach(v=>{ freq[v]=(freq[v]||0)+1 })
  const max = Math.max(...Object.values(freq))
  return Object.entries(freq).filter(([,c])=>c===max).map(([v])=>v)
}

function stddev(arr) {
  const m = arr.reduce((a,b)=>a+b,0)/arr.length
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length)
}

const fmt = v => {
  if(v==null||isNaN(v)) return 'N/A'
  const n=Number(v)
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+'B'
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(2)+'M'
  if(Math.abs(n)>=1e3) return (n/1e3).toFixed(1)+'K'
  return n.toLocaleString(undefined,{maximumFractionDigits:2})
}
const pct = (v,t) => t>0?(v/t*100).toFixed(1)+'%':'0%'

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA — built dynamically from uploaded rows
// ─────────────────────────────────────────────────────────────────────────────
function buildSchema(rows) {
  if (!rows.length) return { numCols:[], catCols:[], allCols:[] }
  const keys = Object.keys(rows[0])
  const numCols=[], catCols=[]
  keys.forEach(k => {
    const vals = rows.map(r=>toNum(r[k])).filter(v=>v!==null)
    const pct  = vals.length / rows.length
    if (pct >= 0.6) numCols.push(k)
    else catCols.push(k)
  })
  return { numCols, catCols, allCols: keys }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN MATCHER — fuzzy match query text against actual column names
// ─────────────────────────────────────────────────────────────────────────────
function findCol(query, colList) {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g,'')
  // Exact match
  let found = colList.find(c => c.toLowerCase().replace(/[^a-z0-9]/g,'') === q)
  if (found) return found
  // Substring match — column name is in query
  found = colList.find(c => {
    const cn = c.toLowerCase().replace(/[^a-z0-9]/g,'')
    return cn.includes(q) || q.includes(cn)
  })
  if (found) return found
  // Token match — any word in query matches part of column
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>1)
  for (const word of words) {
    found = colList.find(c => {
      const cn = c.toLowerCase().replace(/[^a-z0-9]/g,'')
      return cn.includes(word) || word.includes(cn)
    })
    if (found) return found
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER PARSER — detects "in X=1", "where Y=CSE", "for Z Female" etc.
// Fully dynamic — reads unique values from actual uploaded rows
// ─────────────────────────────────────────────────────────────────────────────
function parseFilters(query, rows, schema) {
  const filters = []
  const { allCols } = schema
  const q = query.toLowerCase()

  for (const col of allCols) {
    const cn = col.toLowerCase().replace(/[^a-z0-9]/g,'')
    // Get unique values from actual data
    const uniqueVals = [...new Set(rows.map(r=>String(r[col]||'').trim()).filter(Boolean))]

    // Check if any unique value appears in the query
    for (const val of uniqueVals) {
      const vn = val.toLowerCase()
      // Match: "semester 1", "in cse", "for female", "department=sales"
      const patterns = [
        new RegExp(`${cn}\\s*[=:\\s]\\s*${vn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 'i'),
        new RegExp(`\\b${vn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'i'),
      ]
      for (const p of patterns) {
        if (p.test(query)) {
          filters.push({ col, val, operator:'eq' })
          break
        }
      }
    }
  }

  // Deduplicate: one filter per column
  const seen = new Set()
  return filters.filter(f => { if(seen.has(f.col)) return false; seen.add(f.col); return true })
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY FILTERS — returns subset of rows matching all filters
// ─────────────────────────────────────────────────────────────────────────────
function applyFilters(rows, filters) {
  if (!filters.length) return rows
  return rows.filter(row =>
    filters.every(f => String(row[f.col]||'').trim().toLowerCase() === f.val.toLowerCase())
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION DETECTOR — detects what the user wants to compute
// ─────────────────────────────────────────────────────────────────────────────
function detectOperation(q) {
  const t = q.toLowerCase()
  if (/\b(most repeated|most common|most frequent|mode|which.*repeated|repeated more|occur most)\b/i.test(t)) return 'mode'
  if (/\b(least repeated|least common|least frequent|occur least)\b/i.test(t)) return 'least_frequent'
  if (/\b(standard deviation|std dev|variance|spread)\b/i.test(t)) return 'stddev'
  if (/\b(median|middle value|50th percentile)\b/i.test(t)) return 'median'
  if (/\b(count|how many|number of|total number|instances|occurrences)\b/i.test(t)) return 'count'
  if (/\b(unique|distinct|different values|how many types)\b/i.test(t)) return 'unique'
  if (/\b(frequency|distribution|breakdown|proportion|percentage|share|percent)\b/i.test(t)) return 'frequency'
  if (/\b(average|avg|mean|typical|per student|per record|per employee)\b/i.test(t)) return 'avg'
  if (/\b(total|sum|overall|combined|grand total|aggregate|add up)\b/i.test(t)) return 'sum'
  if (/\b(highest|most|maximum|max|top|best|greatest|largest|leading|more)\b/i.test(t)) return 'max'
  if (/\b(lowest|least|minimum|min|bottom|worst|smallest|fewest|less)\b/i.test(t)) return 'min'
  if (/\b(by|grouped by|per|each|across|for each|compare.*by|group by)\b/i.test(t)) return 'groupby'
  if (/\b(trend|over time|monthly|growth|change|timeline)\b/i.test(t)) return 'trend'
  if (/\b(summary|overview|describe|about|full picture|tell me|explain)\b/i.test(t)) return 'summary'
  if (/\b(column|field|schema|structure|what.*have)\b/i.test(t)) return 'schema'
  if (/\b(outlier|anomaly|unusual|abnormal|spike)\b/i.test(t)) return 'outlier'
  if (/\b(correlat|relationship)\b/i.test(t)) return 'correlation'
  if (/\b(recommend|suggest|advice|strategy|improve)\b/i.test(t)) return 'recommendation'
  return 'general'
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUPBY DETECTOR — detects "by Department", "per Semester" etc.
// ─────────────────────────────────────────────────────────────────────────────
function detectGroupBy(query, schema) {
  const { allCols } = schema
  const patterns = [
    /\bby\s+(\w+)/gi,
    /\bper\s+(\w+)/gi,
    /\beach\s+(\w+)/gi,
    /\bacross\s+(\w+)/gi,
    /\bfor\s+each\s+(\w+)/gi,
    /\bgroup(?:ed)?\s+by\s+(\w+)/gi,
  ]
  for (const pat of patterns) {
    pat.lastIndex = 0
    const m = pat.exec(query)
    if (m) {
      const col = findCol(m[1], allCols)
      if (col) return col
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE COMPUTE ENGINE — all statistics computed here, never by LLM
// ─────────────────────────────────────────────────────────────────────────────
function compute(op, col, filteredRows, schema, groupByCol, allRows) {
  const { numCols, catCols, allCols } = schema

  // ── GROUPBY ───────────────────────────────────────────────────────────────
  if (op === 'groupby' && groupByCol && col) {
    const groups = {}
    filteredRows.forEach(row => {
      const key = String(row[groupByCol]||'Unknown').trim()
      const v   = toNum(row[col])
      if (v===null) return
      if (!groups[key]) groups[key]=[]
      groups[key].push(v)
    })
    const subOp = /\b(avg|average|mean)\b/i.test(col) ? 'avg' : 'sum'
    const agg = vals => subOp==='avg' ? vals.reduce((a,b)=>a+b,0)/vals.length : vals.reduce((a,b)=>a+b,0)
    const result = Object.entries(groups)
      .map(([name,vals]) => ({ name, value:Math.round(agg(vals)*100)/100, count:vals.length }))
      .sort((a,b)=>b.value-a.value)
    const total = result.reduce((s,r)=>s+r.value,0)
    return { type:'groupby', col, groupByCol, subOp, data:result, total, filteredCount:filteredRows.length }
  }

  // ── NUMERIC OPS ───────────────────────────────────────────────────────────
  if (col && numCols.includes(col)) {
    const vals = filteredRows.map(r=>toNum(r[col])).filter(v=>v!==null)
    if (!vals.length) return { type:'error', msg:`No numeric data found in "${col}" for the given filters.` }

    switch(op) {
      case 'max': {
        const maxVal = Math.max(...vals)
        const row = filteredRows.find(r=>toNum(r[col])===maxVal)
        return { type:'max', col, value:maxVal, row, count:vals.length }
      }
      case 'min': {
        const minVal = Math.min(...vals)
        const row = filteredRows.find(r=>toNum(r[col])===minVal)
        return { type:'min', col, value:minVal, row, count:vals.length }
      }
      case 'avg': return { type:'avg', col, value:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100, count:vals.length, min:Math.min(...vals), max:Math.max(...vals) }
      case 'sum': return { type:'sum', col, value:Math.round(vals.reduce((a,b)=>a+b,0)*100)/100, count:vals.length }
      case 'median': return { type:'median', col, value:median(vals), count:vals.length }
      case 'stddev': return { type:'stddev', col, value:Math.round(stddev(vals)*100)/100, count:vals.length, avg:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100 }
      default: {
        const total = vals.reduce((a,b)=>a+b,0)
        return { type:'stats', col, total:Math.round(total*100)/100, avg:Math.round(total/vals.length*100)/100, min:Math.min(...vals), max:Math.max(...vals), median:median(vals), std:Math.round(stddev(vals)*100)/100, count:vals.length }
      }
    }
  }

  // ── CATEGORICAL OPS ───────────────────────────────────────────────────────
  if (col && catCols.includes(col)) {
    const vals = filteredRows.map(r=>String(r[col]||'').trim()).filter(Boolean)
    if (!vals.length) return { type:'error', msg:`No data found in "${col}" for the given filters.` }
    const freq = {}
    vals.forEach(v=>{ freq[v]=(freq[v]||0)+1 })
    const sorted = Object.entries(freq).sort(([,a],[,b])=>b-a)
    const total = vals.length

    if (op==='mode' || op==='max') return { type:'mode', col, value:sorted[0][0], count:sorted[0][1], total, distribution:sorted.map(([v,c])=>({value:v,count:c,pct:Math.round(c/total*100*10)/10})) }
    if (op==='least_frequent' || op==='min') return { type:'least_frequent', col, value:sorted[sorted.length-1][0], count:sorted[sorted.length-1][1], total, distribution:sorted.map(([v,c])=>({value:v,count:c,pct:Math.round(c/total*100*10)/10})) }
    if (op==='count') return { type:'count', col, total:vals.length, unique:Object.keys(freq).length }
    if (op==='unique') return { type:'unique', col, values:Object.keys(freq), count:Object.keys(freq).length }
    if (op==='frequency') return { type:'frequency', col, total, distribution:sorted.map(([v,c])=>({value:v,count:c,pct:Math.round(c/total*100*10)/10})) }
    // Default for categorical
    return { type:'frequency', col, total, distribution:sorted.map(([v,c])=>({value:v,count:c,pct:Math.round(c/total*100*10)/10})) }
  }

  // ── COUNT (no specific col) ───────────────────────────────────────────────
  if (op==='count') return { type:'count', col:'records', total:filteredRows.length }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  if (op==='summary') {
    const stats = {}
    numCols.forEach(nc => {
      const v = filteredRows.map(r=>toNum(r[nc])).filter(v=>v!==null)
      if (!v.length) return
      const sum = v.reduce((a,b)=>a+b,0)
      stats[nc] = { total:Math.round(sum*100)/100, avg:Math.round(sum/v.length*100)/100, min:Math.min(...v), max:Math.max(...v), count:v.length }
    })
    const catDist = {}
    catCols.forEach(cc => {
      const vals = filteredRows.map(r=>String(r[cc]||'').trim()).filter(Boolean)
      if (!vals.length) return
      const freq = {}; vals.forEach(v=>{ freq[v]=(freq[v]||0)+1 })
      catDist[cc] = Object.entries(freq).sort(([,a],[,b])=>b-a).slice(0,5).map(([v,c])=>({value:v,count:c}))
    })
    return { type:'summary', rowCount:filteredRows.length, totalRows:allRows.length, numStats:stats, catDist }
  }

  // ── SCHEMA ────────────────────────────────────────────────────────────────
  if (op==='schema') return { type:'schema', numCols, catCols, allCols, rowCount:allRows.length }

  // ── OUTLIER ───────────────────────────────────────────────────────────────
  if (op==='outlier' && col && numCols.includes(col)) {
    const vals = filteredRows.map(r=>toNum(r[col])).filter(v=>v!==null)
    const s=[...vals].sort((a,b)=>a-b)
    const q1=s[Math.floor(s.length*0.25)], q3=s[Math.floor(s.length*0.75)]
    const iqr=q3-q1, lo=q1-1.5*iqr, hi=q3+1.5*iqr
    const outlierVals = vals.filter(v=>v<lo||v>hi)
    return { type:'outlier', col, count:outlierVals.length, values:outlierVals.slice(0,10), lo:Math.round(lo*100)/100, hi:Math.round(hi*100)/100 }
  }

  // ── CORRELATION ───────────────────────────────────────────────────────────
  if (op==='correlation' && numCols.length>=2) {
    const pairs = []
    for(let i=0;i<Math.min(numCols.length,5);i++) for(let j=i+1;j<Math.min(numCols.length,5);j++) {
      const v1=filteredRows.map(r=>toNum(r[numCols[i]])).filter(v=>v!==null)
      const v2=filteredRows.map(r=>toNum(r[numCols[j]])).filter(v=>v!==null)
      const len=Math.min(v1.length,v2.length)
      if(len<3) continue
      const m1=v1.slice(0,len).reduce((a,b)=>a+b,0)/len, m2=v2.slice(0,len).reduce((a,b)=>a+b,0)/len
      const num=v1.slice(0,len).reduce((s,v,k)=>s+(v-m1)*(v2[k]-m2),0)
      const d1=Math.sqrt(v1.slice(0,len).reduce((s,v)=>s+(v-m1)**2,0))
      const d2=Math.sqrt(v2.slice(0,len).reduce((s,v)=>s+(v-m2)**2,0))
      const r=d1&&d2?Math.round(num/(d1*d2)*100)/100:0
      pairs.push({c1:numCols[i],c2:numCols[j],r,strength:Math.abs(r)>0.7?'Strong':Math.abs(r)>0.4?'Moderate':'Weak'})
    }
    return { type:'correlation', pairs:pairs.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)) }
  }

  // ── RECOMMENDATION ────────────────────────────────────────────────────────
  if (op==='recommendation') {
    const stats = {}
    numCols.forEach(nc => {
      const v=filteredRows.map(r=>toNum(r[nc])).filter(v=>v!==null)
      if(v.length) stats[nc]={avg:Math.round(v.reduce((a,b)=>a+b,0)/v.length*100)/100,max:Math.max(...v),min:Math.min(...v)}
    })
    return { type:'recommendation', stats, catCols, numCols, rowCount:filteredRows.length }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN FORMATTER — converts computed result to readable response
// ─────────────────────────────────────────────────────────────────────────────
function formatResult(result, filters, op, col, groupByCol, schema, fileName, allRows) {
  if (!result) return fallbackSummary(schema, allRows, fileName)

  const filterLabel = filters.length ? ` (filtered: ${filters.map(f=>`${f.col}=${f.val}`).join(', ')})` : ''
  const fu = followUps(schema)

  switch(result.type) {

    case 'max': return (
      `## 🏆 Highest ${result.col}${filterLabel}\n\n` +
      `**${fmt(result.value)}** is the maximum value of **${result.col}**\n` +
      (result.row ? `\nRecord: ${Object.entries(result.row).map(([k,v])=>`**${k}**: ${v}`).join(' · ')}\n` : '') +
      `\n📊 Based on **${result.count.toLocaleString()} records**\n` + fu
    )

    case 'min': return (
      `## 📉 Lowest ${result.col}${filterLabel}\n\n` +
      `**${fmt(result.value)}** is the minimum value of **${result.col}**\n` +
      (result.row ? `\nRecord: ${Object.entries(result.row).map(([k,v])=>`**${k}**: ${v}`).join(' · ')}\n` : '') +
      `\n📊 Based on **${result.count.toLocaleString()} records**\n` + fu
    )

    case 'avg': return (
      `## 📊 Average ${result.col}${filterLabel}\n\n` +
      `Average **${result.col}**: **${fmt(result.value)}**\n\n` +
      `| Metric | Value |\n|---|---|\n` +
      `| Average | **${fmt(result.value)}** |\n` +
      `| Minimum | ${fmt(result.min)} |\n` +
      `| Maximum | ${fmt(result.max)} |\n` +
      `| Records | ${result.count.toLocaleString()} |\n` + fu
    )

    case 'sum': return (
      `## 💰 Total ${result.col}${filterLabel}\n\n` +
      `Total **${result.col}**: **${fmt(result.value)}** across **${result.count.toLocaleString()} records**\n` + fu
    )

    case 'median': return (
      `## 📊 Median ${result.col}${filterLabel}\n\nMedian value of **${result.col}**: **${fmt(result.value)}** (based on ${result.count.toLocaleString()} records)\n` + fu
    )

    case 'stddev': return (
      `## 📊 Standard Deviation — ${result.col}${filterLabel}\n\n` +
      `| Metric | Value |\n|---|---|\n` +
      `| Std Deviation | **${fmt(result.value)}** |\n` +
      `| Mean | ${fmt(result.avg)} |\n` +
      `| Records | ${result.count.toLocaleString()} |\n` + fu
    )

    case 'stats': return (
      `## 📊 ${result.col} Statistics${filterLabel}\n\n` +
      `| Metric | Value |\n|---|---|\n` +
      `| Total | **${fmt(result.total)}** |\n` +
      `| Average | ${fmt(result.avg)} |\n` +
      `| Median | ${fmt(result.median)} |\n` +
      `| Min | ${fmt(result.min)} |\n` +
      `| Max | ${fmt(result.max)} |\n` +
      `| Std Dev | ${fmt(result.std)} |\n` +
      `| Records | ${result.count.toLocaleString()} |\n` + fu
    )

    case 'mode': return (
      `## 🔁 Most Repeated ${result.col}${filterLabel}\n\n` +
      `**"${result.value}"** appears most frequently — **${result.count} times** (${pct(result.count,result.total)} of records)\n\n` +
      `### Distribution\n| Value | Count | Share |\n|---|---|---|\n` +
      result.distribution.slice(0,10).map(d=>`| **${d.value}** | ${d.count} | ${d.pct}% |`).join('\n') +
      `\n\nTotal records: **${result.total.toLocaleString()}**\n` + fu
    )

    case 'least_frequent': return (
      `## 📉 Least Repeated ${result.col}${filterLabel}\n\n` +
      `**"${result.value}"** appears least — **${result.count} times** (${pct(result.count,result.total)} of records)\n\n` +
      `### Distribution (ascending)\n| Value | Count | Share |\n|---|---|---|\n` +
      [...result.distribution].reverse().slice(0,10).map(d=>`| **${d.value}** | ${d.count} | ${d.pct}% |`).join('\n') +
      `\n` + fu
    )

    case 'frequency': return (
      `## 📊 ${result.col} Frequency Distribution${filterLabel}\n\n` +
      `| Value | Count | Share |\n|---|---|---|\n` +
      result.distribution.slice(0,15).map(d=>`| **${d.value}** | ${d.count} | ${d.pct}% |`).join('\n') +
      `\n\nTotal: **${result.total.toLocaleString()} records**\n` + fu
    )

    case 'count': return (
      `## 📋 Count${filterLabel}\n\n**${result.total.toLocaleString()}** records` +
      (result.unique ? ` with **${result.unique}** unique ${result.col} values` : '') + `\n` + fu
    )

    case 'unique': return (
      `## 🔖 Unique Values — ${result.col}${filterLabel}\n\n` +
      `**${result.count}** distinct values:\n\n` +
      result.values.map(v=>`\`${v}\``).join(', ') + '\n' + fu
    )

    case 'groupby': {
      const isAvg = result.subOp === 'avg'
      const { data, total, col:gc, groupByCol:gb } = result
      let md = `## 📊 ${isAvg?'Average':'Total'} ${gc} by ${gb}${filterLabel}\n\n`
      md += `| Rank | ${gb} | ${isAvg?'Average':'Total'} ${gc} | ${isAvg?'':'Share |'} Records |\n`
      md += `|---|---|---|${isAvg?'':'---|'}---|\n`
      data.slice(0,15).forEach((d,i) => {
        md += `| ${i+1} | **${d.name}** | ${fmt(d.value)} | ${isAvg?'':pct(d.value,total)+' | '}${d.count} |\n`
      })
      if(data.length>15) md += `*...and ${data.length-15} more*\n`
      if(data.length>=2) md += `\n🏆 **${data[0].name}** leads with ${fmt(data[0].value)}`
      return md + fu
    }

    case 'summary': {
      let md = `## 📊 Dataset Summary — "${fileName}"\n\n`
      md += `- **Total records:** ${result.rowCount.toLocaleString()}`
      if(result.rowCount !== result.totalRows) md += ` (filtered from ${result.totalRows.toLocaleString()})`
      md += `\n\n### Numeric Metrics\n| Column | Total | Average | Min | Max |\n|---|---|---|---|---|\n`
      Object.entries(result.numStats).slice(0,6).forEach(([col,s])=>{
        md += `| **${col}** | ${fmt(s.total)} | ${fmt(s.avg)} | ${fmt(s.min)} | ${fmt(s.max)} |\n`
      })
      if(Object.keys(result.catDist).length) {
        md += `\n### Category Distributions\n`
        Object.entries(result.catDist).slice(0,4).forEach(([col,dist])=>{
          md += `\n**${col}:** ${dist.map(d=>`${d.value}(${d.count})`).join(', ')}\n`
        })
      }
      return md + fu
    }

    case 'schema': return (
      `## 📋 Dataset Schema — "${fileName}"\n\n` +
      `**${result.rowCount.toLocaleString()} records**, **${result.allCols.length} columns**\n\n` +
      `📊 **Numeric (${result.numCols.length}):** ${result.numCols.join(', ')||'none'}\n` +
      `🏷️ **Categorical (${result.catCols.length}):** ${result.catCols.join(', ')||'none'}\n` + fu
    )

    case 'outlier': return (
      `## ⚠️ Outliers — ${result.col}${filterLabel}\n\n` +
      (result.count===0
        ? `✅ No outliers detected. All values within normal range (${fmt(result.lo)} – ${fmt(result.hi)})\n`
        : `**${result.count} outliers** found. Normal range: ${fmt(result.lo)} – ${fmt(result.hi)}\nValues: ${result.values.map(fmt).join(', ')}\n`) + fu
    )

    case 'correlation': return (
      `## 🔗 Correlations\n\n| Col 1 | Col 2 | r | Strength |\n|---|---|---|---|\n` +
      result.pairs.map(p=>`| **${p.c1}** | **${p.c2}** | ${p.r} | ${p.strength} |`).join('\n') + '\n' + fu
    )

    case 'recommendation': {
      let md = `## 💡 Recommendations — "${fileName}"\n\n`
      Object.entries(result.stats).slice(0,4).forEach(([col,s])=>{
        md += `- 📊 **${col}**: avg ${fmt(s.avg)}, range ${fmt(s.min)}–${fmt(s.max)}\n`
      })
      return md + fu
    }

    case 'error': return `## ⚠️ No Data\n\n${result.msg}\n\nAvailable columns: ${schema.allCols.join(', ')}\n` + fu

    default: return fallbackSummary(schema, allRows, fileName)
  }
}

function fallbackSummary(schema, rows, fileName) {
  const { numCols, catCols } = schema
  let md = `## 📊 "${fileName}" — ${rows.length.toLocaleString()} records\n\n`
  if(numCols.length) md += `📊 **Numeric:** ${numCols.join(', ')}\n`
  if(catCols.length) md += `🏷️ **Categorical:** ${catCols.join(', ')}\n`
  md += `\n**Try:** *"highest ${numCols[0]||'value'}"*, *"average ${numCols[0]||'metric'}"*, *"most repeated ${catCols[0]||'category'}"*, *"summary"*`
  return md
}

function followUps(schema) {
  const { numCols, catCols } = schema
  const lines = ['\n---\n**Would you like to know:**']
  if(numCols[0] && catCols[0]) lines.push(`- Highest ${numCols[0]} by ${catCols[0]}?`)
  if(numCols[0]) lines.push(`- Average ${numCols[0]}?`)
  if(catCols[0]) lines.push(`- Most repeated ${catCols[0]}?`)
  lines.push('- Give me a complete summary?')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { message, sessionId, conversationHistory = [] } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'message is required.' })

    // No session
    if (!sessionId || !global.sessionCache?.[sessionId]) {
      return res.json({
        reply: `## 👋 Hi! I'm your AI Data Analyst\n\nPlease upload a CSV file first. I can then answer any question:\n- Highest / Lowest / Average / Total\n- Most repeated value\n- Filter: "in Semester 1"\n- Group: "average score by department"\n- Summary, correlations, outliers`,
        source: 'local'
      })
    }

    const session = global.sessionCache[sessionId]
    const allRows = session.rows
    const fileName = session.fileName || 'dataset'

    // Build schema dynamically from actual rows
    const schema = buildSchema(allRows)
    const { numCols, catCols, allCols } = schema

    console.log(`[CHATBOT] "${message.slice(0,60)}" | rows=${allRows.length} | num=${numCols.length} cat=${catCols.length}`)

    // ── Step 1: Detect operation ──────────────────────────────────────────
    const op = detectOperation(message)

    // ── Step 2: Detect group-by column ────────────────────────────────────
    const groupByCol = detectGroupBy(message, schema)

    // ── Step 3: Detect target column ──────────────────────────────────────
    // If groupby detected, target is the metric; otherwise search full query
    let targetCol = null
    const colSearchQuery = groupByCol
      ? message.replace(new RegExp(groupByCol,'gi'),'').replace(/\bby\b/gi,'')
      : message

    // Try numeric cols first (for max/min/avg/sum/std/median)
    if (['max','min','avg','sum','median','stddev','groupby'].includes(op)) {
      targetCol = findCol(colSearchQuery, numCols)
    }
    // Then categorical (for mode/frequency)
    if (!targetCol && ['mode','least_frequent','frequency','unique'].includes(op)) {
      targetCol = findCol(colSearchQuery, catCols)
    }
    // General — try all columns
    if (!targetCol) {
      targetCol = findCol(colSearchQuery, numCols) || findCol(colSearchQuery, catCols)
    }
    // For groupby without explicit target, use first numeric
    if (op === 'groupby' && !targetCol) targetCol = numCols[0]

    // ── Step 4: Parse filters ─────────────────────────────────────────────
    const filters = parseFilters(message, allRows, schema)
    // Exclude the groupBy column from filters to avoid self-filtering
    const activeFilters = filters.filter(f => f.col !== groupByCol && f.col !== targetCol)

    // ── Step 5: Apply filters ─────────────────────────────────────────────
    const filteredRows = applyFilters(allRows, activeFilters)

    if (filteredRows.length === 0 && activeFilters.length > 0) {
      return res.json({
        reply: `## ⚠️ No Matching Records\n\nNo records found matching: ${activeFilters.map(f=>`**${f.col}=${f.val}**`).join(', ')}\n\nTry: ${[...new Set(allRows.map(r=>String(r[activeFilters[0].col]||'')))].slice(0,5).join(', ')}`,
        source: 'local'
      })
    }

    console.log(`[CHATBOT] op=${op} col=${targetCol} groupBy=${groupByCol} filters=${JSON.stringify(activeFilters)} filteredRows=${filteredRows.length}`)

    // ── Step 6: Compute ───────────────────────────────────────────────────
    const result = compute(op, targetCol, filteredRows, schema, groupByCol, allRows)

    // ── Step 7: Format local response ─────────────────────────────────────
    const localReply = formatResult(result, activeFilters, op, targetCol, groupByCol, schema, fileName, allRows)

    // ── Step 8: Optionally enhance with Gemini ────────────────────────────
    if (isAvailable() && result && result.type !== 'error') {
      try {
        const systemPrompt = `You are an AI Data Analyst. Enhance the following pre-computed analysis result.
Rules:
1. Use ONLY the numbers in COMPUTED RESULT below. Never invent values.
2. Add a brief business insight (1-2 sentences) after the data.
3. Keep the Markdown table structure exactly as provided.
4. Add a "Recommendation:" line if useful.
5. End with "Would you like to know:" and 3 follow-up questions using actual column names: ${allCols.join(', ')}

COMPUTED RESULT:
${localReply}

Original question: "${message}"`
        const enhanced = await askGemini(systemPrompt, message)
        if (enhanced?.trim() && enhanced.length > 50) {
          console.log(`[CHATBOT] ✅ Gemini enhanced (${enhanced.length} chars)`)
          return res.json({ reply: enhanced, source: 'gemini' })
        }
      } catch(e) {
        console.warn('[CHATBOT] Gemini skipped:', e.message?.slice(0,80))
      }
    }

    res.json({ reply: localReply, source: 'local' })

  } catch (err) {
    next(err)
  }
})

module.exports = router
