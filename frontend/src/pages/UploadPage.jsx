import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '../api'
import toast from 'react-hot-toast'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, ArrowRight, Sparkles, File } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import DataPreviewTable from '../components/DataPreviewTable'
import { SAMPLE_DATASETS, loadSampleDataset } from '../utils/sampleData'

const MAX_SIZE = 10 * 1024 * 1024

const SAMPLE_COLORS = {
  retail:     { color:'#6366f1', bg:'rgba(99,102,241,0.12)' },
  healthcare: { color:'#34d399', bg:'rgba(52,211,153,0.12)' },
  marketing:  { color:'#f472b6', bg:'rgba(244,114,182,0.12)' },
}

export default function UploadPage({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [error, setError] = useState('')

  const processFile = async (file) => {
    setError('')
    setPreviewData(null)
    setUploadResult(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      setUploadResult(data)
      setPreviewData(data.preview)
      toast.success(`Parsed ${data.rowCount.toLocaleString()} rows successfully`)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      const err = rejected[0].errors[0]
      setError(err.code === 'file-too-large' ? 'File exceeds 10MB limit.' : err.message)
      return
    }
    if (accepted.length > 0) processFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  })

  const loadSample = async (key) => {
    setError('')
    setUploading(true)
    try {
      const file = await loadSampleDataset(key)
      await processFile(file)
    } catch { setError('Failed to load sample.') }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#030712', display:'flex', alignItems:'center', justifyContent:'center', padding:24, position:'relative', overflow:'hidden' }}>
      {/* BG orbs */}
      <div style={{ position:'absolute', top:'10%', left:'5%', width:400, height:400, background:'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'10%', right:'5%', width:300, height:300, background:'radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:680, position:'relative', zIndex:1 }} className="animate-fade-in">

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:99, padding:'5px 14px', marginBottom:16 }}>
            <Upload size={13} color="#818cf8" />
            <span style={{ fontSize:'0.78rem', color:'#a5b4fc', fontWeight:500 }}>Step 1 of 3 — Upload</span>
          </div>
          <h1 style={{ fontSize:'2.2rem', fontWeight:800, color:'white', letterSpacing:'-0.03em', marginBottom:8 }}>Upload Your Data</h1>
          <p style={{ color:'#64748b', fontSize:'0.95rem' }}>Drop a CSV or Excel file and we'll handle the rest.</p>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? '#6366f1' : 'rgba(99,102,241,0.25)'}`,
            borderRadius: 20,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: isDragActive ? 'rgba(99,102,241,0.08)' : 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.3s ease',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isDragActive && (
            <div style={{ position:'absolute', inset:0, background:'rgba(99,102,241,0.05)', borderRadius:18 }} />
          )}
          <input {...getInputProps()} />
          {uploading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              <LoadingSpinner size={44} />
              <p style={{ color:'#a5b4fc', fontWeight:600, fontSize:'1rem' }}>Analyzing your file…</p>
              <p style={{ color:'#475569', fontSize:'0.8rem' }}>Detecting schema and parsing data</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
              <div style={{ width:72, height:72, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:4 }} className="animate-float">
                <Upload size={32} color="#6366f1" />
              </div>
              <div>
                <p style={{ color:'white', fontWeight:600, fontSize:'1.1rem', marginBottom:4 }}>
                  {isDragActive ? '✨ Drop it right here!' : 'Drag & drop your file'}
                </p>
                <p style={{ color:'#475569', fontSize:'0.87rem' }}>
                  or <span style={{ color:'#818cf8', textDecoration:'underline', cursor:'pointer' }}>browse to upload</span>
                </p>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {['CSV','XLS','XLSX'].map(ext => (
                  <span key={ext} style={{ padding:'2px 10px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:6, color:'#818cf8', fontSize:'0.72rem', fontWeight:600 }}>{ext}</span>
                ))}
                <span style={{ padding:'2px 10px', background:'rgba(51,65,85,0.5)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:6, color:'#64748b', fontSize:'0.72rem', fontWeight:600 }}>MAX 10MB</span>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
            <AlertCircle size={16} color="#f87171" style={{ marginTop:1, flexShrink:0 }} />
            <p style={{ color:'#fca5a5', fontSize:'0.87rem', flex:1 }}>{error}</p>
            <button onClick={() => setError('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171' }}><X size={14} /></button>
          </div>
        )}

        {/* Sample datasets */}
        <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:16, padding:'16px 20px', marginBottom:20 }}>
          <p style={{ color:'#64748b', fontSize:'0.78rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>Or try a sample dataset</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {Object.entries(SAMPLE_DATASETS).map(([key, { label, industry }]) => {
              const c = SAMPLE_COLORS[key] || SAMPLE_COLORS.retail
              return (
                <button key={key} onClick={() => loadSample(key)} disabled={uploading}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:c.bg, border:`1px solid ${c.color}30`, borderRadius:10, cursor:'pointer', transition:'all 0.2s', opacity: uploading ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = c.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${c.color}30`}
                >
                  <FileSpreadsheet size={14} color={c.color} />
                  <span style={{ color:'#cbd5e1', fontSize:'0.83rem', fontWeight:500 }}>{label}</span>
                  <span style={{ fontSize:'0.65rem', fontWeight:600, padding:'1px 6px', background:`${c.color}20`, color:c.color, borderRadius:99, textTransform:'uppercase' }}>{industry}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        {uploadResult && previewData && (
          <div className="animate-slide-up">
            {/* Success bar */}
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
              <CheckCircle2 size={18} color="#34d399" />
              <div style={{ flex:1 }}>
                <p style={{ color:'#6ee7b7', fontWeight:600, fontSize:'0.9rem' }}>{uploadResult.fileName}</p>
                <p style={{ color:'#475569', fontSize:'0.78rem' }}>{uploadResult.rowCount.toLocaleString()} rows · {uploadResult.columnCount} columns · <span style={{ color:'#818cf8', textTransform:'capitalize' }}>{uploadResult.industry}</span> context</p>
              </div>
            </div>

            {uploadResult.warnings?.length > 0 && (
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
                {uploadResult.warnings.map((w, i) => <p key={i} style={{ color:'#fcd34d', fontSize:'0.8rem' }}>⚠ {w}</p>)}
              </div>
            )}

            {/* Data preview */}
            <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:16, padding:16, marginBottom:20, overflow:'hidden' }}>
              <p style={{ color:'#475569', fontSize:'0.75rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>Preview — first 10 rows</p>
              <DataPreviewTable data={previewData} />
            </div>

            <div style={{ textAlign:'center' }}>
              <p style={{ color:'#475569', fontSize:'0.85rem', marginBottom:14 }}>Does this look correct?</p>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => onUploadSuccess(uploadResult)} className="btn-primary" style={{ fontSize:'0.95rem', padding:'12px 28px' }}>
                  Yes, Analyze This <ArrowRight size={16} />
                </button>
                <button onClick={() => { setUploadResult(null); setPreviewData(null) }} className="btn-secondary">
                  Re-upload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
