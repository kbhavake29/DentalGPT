import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Search, Loader2, FileText, Clock, ChevronRight, Upload, X } from 'lucide-react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [showSources, setShowSources] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [patientHistory, setPatientHistory] = useState([])
  const [recentQueries, setRecentQueries] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const exampleQuestions = [
    "What is the recommended treatment for acute pulpitis?",
    "How do I manage a patient with dental anxiety?",
    "What are the indications for root canal treatment?",
    "What is the protocol for managing dental trauma in children?",
    "How should I handle a patient with bleeding disorders during extraction?",
    "What are the best practices for oral hygiene instruction?"
  ]

  useEffect(() => {
    loadRecentQueries()
  }, [])

  useEffect(() => {
    if (patientId) {
      loadPatientHistory()
    }
  }, [patientId])

  const loadRecentQueries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/recent-queries?limit=5`)
      setRecentQueries(response.data.queries || [])
    } catch (error) {
      console.error('Error loading recent queries:', error)
    }
  }

  const loadPatientHistory = async () => {
    if (!patientId) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/patient-history/${patientId}`)
      setPatientHistory(response.data.history || [])
    } catch (error) {
      console.error('Error loading patient history:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setAnswer('')
    setSources([])
    setShowSources(false)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/query`, {
        query: query,
        patient_id: patientId || null
      })

      setAnswer(response.data.answer)
      setSources(response.data.sources || [])
      setShowSources(true)
      
      // Refresh history
      loadRecentQueries()
      if (patientId) {
        loadPatientHistory()
      }
    } catch (error) {
      console.error('Error querying:', error)
      setAnswer('Sorry, there was an error processing your query. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (example) => {
    setQuery(example)
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadStatus('Please select a file')
      return
    }

    setUploading(true)
    setUploadStatus('')

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadTitle) {
        formData.append('title', uploadTitle)
      }

      const response = await axios.post(`${API_BASE_URL}/api/upload-document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setUploadStatus(`✓ Successfully uploaded ${response.data.filename}! Ingested ${response.data.chunks} chunks.`)
      setUploadFile(null)
      setUploadTitle('')
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setShowUpload(false)
        setUploadStatus('')
      }, 3000)
    } catch (error) {
      console.error('Error uploading file:', error)
      setUploadStatus(`Error: ${error.response?.data?.detail || error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploadFile(file)
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setShowHistory(!showHistory)}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="sidebar-content">
          <div className="patient-input-section">
            <label htmlFor="patient-id">Patient ID (Optional)</label>
            <input
              id="patient-id"
              type="text"
              placeholder="Enter patient ID"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="patient-input"
            />
          </div>
          
          {patientId && patientHistory.length > 0 && (
            <div className="history-section">
              <h3>Patient History</h3>
              <div className="history-list">
                {patientHistory.map((item) => (
                  <div key={item.id} className="history-item" onClick={() => setQuery(item.query_text)}>
                    <FileText size={14} />
                    <span>{item.query_text.substring(0, 50)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentQueries.length > 0 && (
            <div className="recent-section">
              <h3>Recent Queries</h3>
              <div className="history-list">
                {recentQueries.map((item) => (
                  <div key={item.id} className="history-item" onClick={() => setQuery(item.query_text)}>
                    <Clock size={14} />
                    <span>{item.query_text.substring(0, 50)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <h1 className="logo">DentalGPT<span className="beta"> BETA</span></h1>
            <p className="tagline">Built by clinicians for clinicians</p>
            <button 
              className="upload-button-header"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Upload size={18} />
              {showUpload ? 'Hide Upload' : 'Upload Document'}
            </button>
          </div>
        </header>

        {/* Document Upload Section */}
        {showUpload && (
          <div className="upload-section">
            <div className="upload-box">
              <h3>Upload Dental Guidelines Document</h3>
              <p className="upload-description">
                Upload PDF, TXT, DOCX, or MD files to add them to the knowledge base
              </p>
              <form onSubmit={handleFileUpload} className="upload-form">
                <div className="upload-input-group">
                  <label htmlFor="file-upload" className="file-label">
                    <Upload size={20} />
                    {uploadFile ? uploadFile.name : 'Choose File'}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.txt,.docx,.md"
                    onChange={handleFileChange}
                    className="file-input"
                    disabled={uploading}
                  />
                </div>
                <div className="upload-input-group">
                  <input
                    type="text"
                    placeholder="Document Title (optional)"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="title-input"
                    disabled={uploading}
                  />
                </div>
                <button 
                  type="submit" 
                  className="upload-submit-button"
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload & Ingest
                    </>
                  )}
                </button>
                {uploadStatus && (
                  <div className={`upload-status ${uploadStatus.startsWith('✓') ? 'success' : 'error'}`}>
                    {uploadStatus}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Query Section */}
        <div className="query-section">
          <form onSubmit={handleSubmit} className="query-form">
            <div className="query-input-wrapper">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your dental question here..."
                className="query-input"
                rows={3}
                disabled={loading}
              />
              <button 
                type="submit" 
                className="submit-button"
                disabled={loading || !query.trim()}
              >
                {loading ? <Loader2 size={20} className="spinner" /> : <Search size={20} />}
              </button>
            </div>
          </form>

          {/* Example Questions */}
          <div className="examples-section">
            <p className="examples-label">+ Ask about treatments, procedures, diagnoses, and more</p>
            <p className="examples-subtitle">Try an example question to get started:</p>
            <div className="examples-grid">
              {exampleQuestions.map((example, idx) => (
                <button
                  key={idx}
                  className="example-button"
                  onClick={() => handleExampleClick(example)}
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Answer Section */}
        {answer && (
          <div className="answer-section">
            <div className="answer-content">
              <h2 className="answer-title">Answer</h2>
              <div className="answer-text">{answer}</div>
              
              {sources.length > 0 && (
                <div className="sources-section">
                  <button 
                    className="sources-toggle"
                    onClick={() => setShowSources(!showSources)}
                  >
                    <FileText size={16} />
                    Sources ({sources.length})
                    <ChevronRight 
                      size={16} 
                      className={showSources ? 'expanded' : ''} 
                    />
                  </button>
                  
                  {showSources && (
                    <div className="sources-list">
                      {sources.map((source, idx) => (
                        <div key={idx} className="source-item">
                          <div className="source-header">
                            <span className="source-number">Source {idx + 1}</span>
                            <span className="source-score">Relevance: {(source.score * 100).toFixed(1)}%</span>
                          </div>
                          <div className="source-text">{source.text}</div>
                          {source.metadata?.title && (
                            <div className="source-meta">From: {source.metadata.title}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <footer className="footer">
          <p className="disclaimer">
            <strong>Disclaimer:</strong> DentalGPT includes functionality powered by generative artificial intelligence ("GenAI"). 
            Certain content in DentalGPT, including any output responsive to input(s), has been generated by GenAI, has not been 
            reviewed by a human, and may contain errors. DentalGPT is not intended for use with personal data (information related 
            to an identified or identifiable individual), including protected health information or "PHI", and is not designed to 
            protect such information. This tool is for clinical reference only and should not replace professional clinical judgment.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
