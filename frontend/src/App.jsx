import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { STEPS } from './constants'
import LandingPage from './pages/LandingPage'
import UploadPage from './pages/UploadPage'
import SchemaPage from './pages/SchemaPage'
import GraphConfigPage from './pages/GraphConfigPage'
import DashboardPage from './pages/DashboardPage'
import ExportPage from './pages/ExportPage'
import Navbar from './components/Navbar'
import ChatbotWidget from './components/ChatbotWidget'
import { getIndustryConfig } from './config/industryConfigs'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding:40, color:'white', background:'#0f172a', minHeight:'100vh' }}>
        <h2 style={{ color:'#ef4444', marginBottom:12 }}>App Error</h2>
        <pre style={{ color:'#94a3b8', fontSize:12, whiteSpace:'pre-wrap', background:'#1e293b', padding:16, borderRadius:8 }}>
          {this.state.error?.toString()}
        </pre>
        <button onClick={() => window.location.reload()}
          style={{ marginTop:20, padding:'10px 20px', background:'#6366f1', color:'white', border:'none', borderRadius:8, cursor:'pointer' }}>
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  const [step,         setStep]         = useState(STEPS.LANDING)
  const [uploadData,   setUploadData]   = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [insights,     setInsights]     = useState(null)
  const [showExport,   setShowExport]   = useState(false)

  const resetAll = () => {
    setStep(STEPS.LANDING)
    setUploadData(null)
    setAnalysisData(null)
    setInsights(null)
    setShowExport(false)
  }

  const currentConfig = analysisData
    ? getIndustryConfig(analysisData.industry || 'general')
    : null

  // Show export overlay on top of dashboard
  if (showExport && analysisData) {
    return (
      <ErrorBoundary>
        <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
          <ExportPage
            analysisData={analysisData}
            insights={insights}
            uploadData={uploadData}
            config={currentConfig}
            onClose={() => setShowExport(false)}
          />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950">
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background:'#1e293b', color:'#f1f5f9', border:'1px solid #334155' },
            success: { iconTheme: { primary:'#6366f1', secondary:'#fff' } },
          }}
        />
        {step !== STEPS.LANDING && <Navbar step={step} onReset={resetAll} onNavigate={(s) => setStep(s)} />}
        <main className={step !== STEPS.LANDING ? 'pt-16' : ''}>
          {step === STEPS.LANDING && <LandingPage onStart={() => setStep(STEPS.UPLOAD)} />}
          {step === STEPS.UPLOAD  && <UploadPage  onUploadSuccess={(d) => { setUploadData(d); setStep(STEPS.SCHEMA) }} />}
          {step === STEPS.SCHEMA  && uploadData && (
            <SchemaPage uploadData={uploadData}
              onAnalysisDone={(data, ins) => { setAnalysisData(data); setInsights(ins); setStep(STEPS.GRAPH_CONFIG) }} />
          )}
          {step === STEPS.GRAPH_CONFIG && analysisData && (
            <GraphConfigPage
              uploadData={uploadData}
              analysisData={analysisData}
              config={currentConfig}
              onProceed={() => setStep(STEPS.DASHBOARD)}
              onBack={() => setStep(STEPS.SCHEMA)}
            />
          )}
          {step === STEPS.DASHBOARD && analysisData && (
            <DashboardPage
              analysisData={analysisData}
              insights={insights}
              uploadData={uploadData}
              onReset={resetAll}
              onExport={() => setShowExport(true)}
            />
          )}
        </main>
        {/* Chatbot — always visible after upload */}
        {uploadData && <ChatbotWidget uploadData={uploadData} analysisData={analysisData} />}
      </div>
    </ErrorBoundary>
  )
}
