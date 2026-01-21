import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Grid3x3, Folder, Smile, Settings, Paperclip, ArrowUp, ChevronRight, ChevronDown, Upload, X, Clock, FileText, Star, Mic, MicOff, LogOut, Edit2, Trash2, Save, Send, User, Search } from 'lucide-react'
import Auth from './Auth'
import { LiveWaveform } from './LiveWaveform'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  // Check localStorage and URL parameters immediately to determine initial view
  const getInitialView = () => {
    // Check URL parameters first (from landing page redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (tokenParam && userParam) {
      // Auth data in URL - will be processed by useEffect
      return 'chat'
    }
    
    // Check localStorage
    const token = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      return 'chat'
    }
    return 'landing'
  }

  const [currentView, setCurrentView] = useState(getInitialView) // 'landing', 'auth', 'chat'
  const [user, setUser] = useState(() => {
    // Check URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    if (userParam) {
      try {
        return JSON.parse(decodeURIComponent(userParam));
      } catch (e) {
        console.error('Error parsing user from URL:', e);
      }
    }
    // Fall back to localStorage
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [authToken, setAuthToken] = useState(() => {
    // Check URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      return decodeURIComponent(tokenParam);
    }
    // Fall back to localStorage
    return localStorage.getItem('auth_token') || null
  })
  const [modelProvider, setModelProvider] = useState(() => {
    // Load from localStorage or default to 'ollama'
    return localStorage.getItem('model_provider') || 'ollama'
  })
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioStream, setAudioStream] = useState(null) // Share stream with LiveWaveform
  const [voiceState, setVoiceState] = useState('idle') // 'idle', 'recording', 'thinking', 'speaking'
  // Chat management
  const [chats, setChats] = useState([{ id: '1', title: 'New Chat', messages: [], createdAt: new Date(), attachedDocuments: [], isFavorite: false }])
  const [activeChatId, setActiveChatId] = useState('1')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  
  // UI state
  const [showRightSidebar, setShowRightSidebar] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadedImage, setUploadedImage] = useState(null) // Store base64 image data
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null) // Store image preview URL
  const [editingChatId, setEditingChatId] = useState(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [currentLeftTab, setCurrentLeftTab] = useState(null) // 'collections', 'files', 'feedback', 'settings', 'patients'
  const [activeChatTab, setActiveChatTab] = useState('recent') // 'recent' or 'favorite'
  
  // History
  const [recentQueries, setRecentQueries] = useState([])
  const [patientId, setPatientId] = useState('')
  const [patientHistory, setPatientHistory] = useState([])
  
  // Patient management
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  const [showAddPatientForm, setShowAddPatientForm] = useState(false)
  const [newPatient, setNewPatient] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    medical_history: '',
    dental_history: '',
    allergies: '',
    medications: '',
    summary: ''
  })

  const exampleQuestions = [
    "What is the recommended treatment for acute pulpitis?",
    "How do I manage a patient with dental anxiety?",
    "What are the indications for root canal treatment?",
    "What is the protocol for managing dental trauma in children?",
    "How should I handle a patient with bleeding disorders during extraction?",
    "What are the best practices for oral hygiene instruction?"
  ]

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0] || {
    id: '1',
    title: 'New Chat',
    messages: [],
    createdAt: new Date(),
    attachedDocuments: [],
    isFavorite: false
  }

  useEffect(() => {
    // Check URL parameters for auth data (from landing page redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (tokenParam && userParam) {
      try {
        const decodedToken = decodeURIComponent(tokenParam);
        const decodedUser = JSON.parse(decodeURIComponent(userParam));
        
        // Save to localStorage
        localStorage.setItem('auth_token', decodedToken);
        localStorage.setItem('user', JSON.stringify(decodedUser));
        
        // Update state
        setAuthToken(decodedToken);
        setUser(decodedUser);
        setCurrentView('chat');
        
        // Clean up URL parameters immediately
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        console.log('Auth data loaded from URL parameters and saved to localStorage');
        console.log('URL cleaned:', newUrl);
      } catch (error) {
        console.error('Error parsing auth data from URL:', error);
        // Still clean up URL even if there's an error
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [])

  useEffect(() => {
    if (user && authToken) {
      loadUserChats()
      loadRecentQueries()
      loadPatients()
    }
  }, [user, authToken])
  
  useEffect(() => {
    if (selectedPatient?.id) {
      setPatientId(selectedPatient.id)
      // Patient chats will be loaded by handleSelectPatient
      // This effect just ensures patientId is set
    } else {
      setPatientId('')
      // Only load user chats if we're not in patient mode
      if (!selectedPatient) {
        loadUserChats()
      }
    }
  }, [selectedPatient?.id]) // Only depend on patient ID to avoid infinite loops

  useEffect(() => {
    if (patientId) {
      loadPatientHistory()
    }
  }, [patientId])
  
  // Update patient summary when switching to a chat that's linked to a different patient
  useEffect(() => {
    if (!activeChat) return
    
    // Clear uploaded image when switching chats
    clearUploadedImage()
    
    const chatPatientId = activeChat.patientId
    
    if (chatPatientId) {
      // Chat is linked to a patient
      // Only update if selectedPatient doesn't match or doesn't exist
      if (!selectedPatient || selectedPatient.id !== chatPatientId) {
        console.log('Chat patientId:', chatPatientId, 'Selected patient:', selectedPatient?.id)
        // Load the patient info for this chat
        loadPatient(chatPatientId).then(patientDetails => {
          if (patientDetails) {
            console.log('Updating selected patient from chat:', patientDetails.id, patientDetails.name)
            setSelectedPatient(patientDetails)
          }
        })
      } else {
        console.log('Selected patient matches chat patient, no update needed')
      }
    } else {
      // Chat is not linked to any patient - clear patient summary
      if (selectedPatient) {
        console.log('Clearing selected patient - chat has no patientId')
        setSelectedPatient(null)
      }
    }
  }, [activeChatId]) // Only depend on activeChatId to avoid conflicts

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-name-dropdown')) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserDropdown])

  useEffect(() => {
    // Save model provider to localStorage whenever it changes
    localStorage.setItem('model_provider', modelProvider)
  }, [modelProvider])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (showModelDropdown) {
        const dropdown = document.querySelector('.model-dropdown-menu')
        const button = document.querySelector('.model-dropdown-btn')
        if (dropdown && !dropdown.contains(event.target) && !button.contains(event.target)) {
          setShowModelDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown])

  const loadUserChats = async () => {
    if (!authToken) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/chats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      const chatsData = response.data.chats.map(chat => ({
        id: chat.id.toString(),
        title: chat.title,
        messages: [],
        createdAt: new Date(chat.created_at),
        attachedDocuments: [],
        isFavorite: chat.is_favorite || false,
        patientId: chat.patient_id || null
      }))
      if (chatsData.length > 0) {
        setChats(chatsData)
        setActiveChatId(chatsData[0].id)
        // Load messages for active chat
        loadChatMessages(chatsData[0].id)
      } else {
        // Create a default chat if user has no chats
        await createNewChat()
      }
    } catch (error) {
      console.error('Error loading chats:', error)
      // If error, try to create a default chat
      try {
        await createNewChat()
      } catch (createError) {
        console.error('Error creating default chat:', createError)
      }
    }
  }

  const loadChatMessages = async (chatId) => {
    if (!authToken) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      const messages = response.data.messages.map(msg => {
        // Handle sources - could be JSON string or already parsed object
        let sources = null
        if (msg.sources) {
          if (typeof msg.sources === 'string') {
            try {
              sources = JSON.parse(msg.sources)
            } catch (e) {
              console.warn('Failed to parse sources JSON:', e)
              sources = null
            }
          } else {
            sources = msg.sources
          }
        }
        
        return {
          id: msg.id.toString(),
          type: msg.message_type,
          content: msg.content,
          sources: sources,
          image: msg.image ? `data:image/jpeg;base64,${msg.image}` : null,
          timestamp: new Date(msg.created_at)
        }
      })
      
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === chatId.toString()) {
          // Preserve attachedDocuments from the existing chat
          const existingChat = prevChats.find(c => c.id === chatId.toString())
          return { 
            ...chat, 
            messages, 
            attachedDocuments: existingChat?.attachedDocuments || chat.attachedDocuments || []
          }
        }
        return chat
      }))
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadRecentQueries = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/recent-queries?limit=10`)
      setRecentQueries(response.data.queries || [])
    } catch (error) {
      console.error('Error loading recent queries:', error)
    }
  }

  const handleAuthSuccess = (userData, token) => {
    console.log('Auth successful, user:', userData)
    setUser(userData)
    setAuthToken(token)
    setCurrentView('chat')
    // Load user chats after a short delay to ensure state is set
    setTimeout(() => {
      loadUserChats()
    }, 100)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setUser(null)
    setAuthToken(null)
    setChats([{ id: '1', title: 'New Chat', messages: [], createdAt: new Date(), attachedDocuments: [], isFavorite: false }])
    setActiveChatId('1')
    setCurrentView('landing')
  }

  const formatResponse = (text) => {
    if (!text) return text

    // Split by double newlines to get paragraphs
    let formatted = text

    // Convert markdown-style bullet points (* or -) to proper lists
    formatted = formatted.replace(/^\* (.+)$/gm, '• $1')
    formatted = formatted.replace(/^- (.+)$/gm, '• $1')

    // Handle numbered lists (1. 2. etc.)
    formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '$1. $2')

    return formatted
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderFormattedContent = (content) => {
    if (!content) return ''

    // Preprocess content to remove excessive newlines
    const processed = content
      // Replace multiple consecutive newlines with double newline
      .replace(/\n{3,}/g, '\n\n')
      // Remove newlines after bullet points
      .replace(/•\s*\n/g, '• ')
      // Remove trailing newlines
      .trim()

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children }) => <strong className="markdown-bold">{children}</strong>,
        }}
      >
        {processed}
      </ReactMarkdown>
    )
  }

  const handleToggleFavorite = async (chatId) => {
    const chat = chats.find(c => c.id === chatId.toString())
    if (!chat) return

    const newFavoriteStatus = !chat.isFavorite

    // Update in frontend immediately
    setChats(prevChats => prevChats.map(chat =>
      chat.id === chatId.toString() 
        ? { ...chat, isFavorite: newFavoriteStatus }
        : chat
    ))

    // If authenticated, save to backend
    if (authToken) {
      try {
        const chatIdNum = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId
        await axios.patch(
          `${API_BASE_URL}/api/chats/${chatIdNum}`,
          { is_favorite: newFavoriteStatus },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
      } catch (error) {
        console.error('Error updating favorite status:', error)
        // Revert on error
        setChats(prevChats => prevChats.map(chat =>
          chat.id === chatId.toString() 
            ? { ...chat, isFavorite: !newFavoriteStatus }
            : chat
        ))
      }
    }
  }

  const handleRenameChat = async (chatId, newTitle) => {
    if (!newTitle || !newTitle.trim()) {
      setEditingChatId(null)
      setEditingChatTitle('')
      return
    }

    if (!authToken) {
      // Local rename
      setChats(prevChats => prevChats.map(chat =>
        chat.id === chatId.toString() ? { ...chat, title: newTitle.trim() } : chat
      ))
      setEditingChatId(null)
      setEditingChatTitle('')
      return
    }

    try {
      // Convert chatId to number for backend
      const chatIdNum = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId
      
      // Update in backend
      const response = await axios.patch(
        `${API_BASE_URL}/api/chats/${chatIdNum}`,
        { title: newTitle.trim() },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )

      // Update in frontend
      setChats(prevChats => prevChats.map(chat =>
        chat.id === chatId.toString() ? { ...chat, title: response.data.title || newTitle.trim() } : chat
      ))
      setEditingChatId(null)
      setEditingChatTitle('')
    } catch (error) {
      console.error('Error renaming chat:', error)
      console.error('Error details:', error.response?.data)
      alert(`Failed to rename chat: ${error.response?.data?.detail || error.message}`)
      setEditingChatId(null)
      setEditingChatTitle('')
    }
  }

  const handleDeleteChat = async (chatId) => {
    if (!authToken) {
      // Local chat deletion
      const chatIdStr = chatId.toString()
      setChats(prevChats => {
        const filtered = prevChats.filter(chat => chat.id !== chatIdStr)
        if (activeChatId === chatIdStr && filtered.length > 0) {
          setActiveChatId(filtered[0].id)
        } else if (activeChatId === chatIdStr) {
          setActiveChatId('1')
        }
        return filtered
      })
      return
    }

    try {
      // Convert chatId to number for backend
      const chatIdNum = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId
      
      await axios.delete(
        `${API_BASE_URL}/api/chats/${chatIdNum}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      )

      // Update in frontend
      const chatIdStr = chatId.toString()
      setChats(prevChats => {
        const filtered = prevChats.filter(chat => chat.id !== chatIdStr)
        
        // If we deleted the active chat, switch to another one
        if (activeChatId === chatIdStr) {
          if (filtered.length > 0) {
            setActiveChatId(filtered[0].id)
            loadChatMessages(filtered[0].id)
          } else {
            // Create a new chat if all deleted
            createNewChat()
          }
        }
        
        return filtered
      })
    } catch (error) {
      console.error('Error deleting chat:', error)
      console.error('Error details:', error.response?.data)
      alert(`Failed to delete chat: ${error.response?.data?.detail || error.message}`)
    }
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioStream(stream) // Share stream with LiveWaveform
      
      const recorder = new MediaRecorder(stream)
      const audioChunks = []

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      recorder.onstop = async () => {
        setVoiceState('thinking')
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        await transcribeAudio(audioBlob)
        
        // Cleanup stream
        stream.getTracks().forEach(track => track.stop())
        setAudioStream(null)
        setVoiceState('idle')
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setVoiceState('recording') // Go directly to recording state
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Microphone access denied. Please enable microphone permissions.')
      setVoiceState('idle')
      setAudioStream(null)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      setVoiceState('thinking')
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
      // Don't stop stream here - let LiveWaveform handle it or wait for onstop
    }
  }

  const transcribeAudio = async (audioBlob) => {
    try {
      setVoiceState('thinking')
      // Convert blob to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result.split(',')[1]
          
          const response = await axios.post(
            `${API_BASE_URL}/api/voice/transcribe`,
            { audio_data: base64Audio },
            { headers: { Authorization: `Bearer ${authToken}` } }
          )
          
          setQuery(response.data.text)
          setVoiceState('idle')
        } catch (error) {
          console.error('Error transcribing audio:', error)
          alert('Failed to transcribe audio. Please try again.')
          setVoiceState('idle')
        }
      }
      reader.readAsDataURL(audioBlob)
    } catch (error) {
      console.error('Error transcribing audio:', error)
      alert('Failed to transcribe audio. Please try again.')
      setVoiceState('idle')
    }
  }

  const loadPatients = async () => {
    if (!authToken) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/patients`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setPatients(response.data.patients || [])
    } catch (error) {
      console.error('Error loading patients:', error)
    }
  }
  
  const loadPatient = async (patientId) => {
    if (!authToken) return
    try {
      const response = await axios.get(`${API_BASE_URL}/api/patients/${patientId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      return response.data
    } catch (error) {
      console.error('Error loading patient:', error)
      return null
    }
  }
  
  const loadPatientChats = async (patientId, patientData = null) => {
    if (!authToken || !patientId) {
      console.log('Cannot load patient chats - missing authToken or patientId')
      return
    }
    try {
      console.log('Loading chats for patient:', patientId)
      const response = await axios.get(`${API_BASE_URL}/api/chats?patient_id=${patientId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('Patient chats response:', response.data)
      const patientChats = response.data.chats.map(chat => ({
        id: chat.id.toString(),
        title: chat.title,
        messages: [],
        createdAt: new Date(chat.created_at),
        attachedDocuments: [],
        isFavorite: chat.is_favorite || false,
        patientId: chat.patient_id || patientId // Ensure patientId is set
      }))
      console.log('Mapped patient chats:', patientChats)
      setChats(patientChats)
      
      // Ensure selectedPatient is set if provided
      if (patientData && (!selectedPatient || selectedPatient.id !== patientData.id)) {
        console.log('Setting selected patient from loadPatientChats:', patientData.id)
        setSelectedPatient(patientData)
      }
      
      if (patientChats.length > 0) {
        const firstChatId = patientChats[0].id
        console.log('Setting active chat to:', firstChatId, 'with patientId:', patientChats[0].patientId)
        setActiveChatId(firstChatId)
        await loadChatMessages(firstChatId)
      } else {
        // If no chats exist for this patient, create one automatically
        console.log('No chats found, creating new chat for patient:', patientId)
        let patientToUse = patientData || selectedPatient
        if (!patientToUse) {
          // If patientData not provided and selectedPatient is not set, load it first
          const patientDetails = await loadPatient(patientId)
          if (patientDetails) {
            patientToUse = patientDetails
            setSelectedPatient(patientDetails)
          }
        }
        if (patientToUse) {
          await handleCreatePatientChat(patientToUse)
        }
      }
    } catch (error) {
      console.error('Error loading patient chats:', error)
      console.error('Error details:', error.response?.data)
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
  
  const handleSelectPatient = async (patient) => {
    console.log('Selecting patient:', patient.id, patient.name)
    
    // Load full patient details first
    const patientDetails = await loadPatient(patient.id)
    const finalPatient = patientDetails || patient
    
    // Set selected patient with full details BEFORE loading chats
    // This ensures the patient summary shows immediately
    console.log('Setting selected patient:', finalPatient.id, finalPatient.name)
    setSelectedPatient(finalPatient)
    
    // Load patient chats - this will auto-create a chat if none exists
    // Pass the patient to ensure it's available when creating chat
    await loadPatientChats(finalPatient.id, finalPatient)
    
    // Close the patient history panel
    setCurrentLeftTab(null)
  }
  
  const handleRefresh = async () => {
    if (authToken) {
      await loadUserChats()
      await loadPatients()
      if (selectedPatient) {
        await loadPatient(selectedPatient.id).then(patientDetails => {
          if (patientDetails) {
            setSelectedPatient(patientDetails)
          }
        })
        if (activeChat?.patientId) {
          await loadPatientChats(activeChat.patientId)
        }
      }
    }
  }
  
  const handleCreatePatientChat = async (patient = null) => {
    const patientToUse = patient || selectedPatient
    if (!patientToUse || !authToken) {
      console.log('Cannot create patient chat - missing patient or authToken')
      return
    }
    try {
      console.log('Creating chat for patient:', patientToUse.id, patientToUse.name)
      const response = await axios.post(
        `${API_BASE_URL}/api/chats`,
        { title: `Chat with ${patientToUse.name}`, patient_id: patientToUse.id },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      console.log('Chat created with response:', response.data)
      const newChat = {
        id: response.data.id.toString(),
        title: response.data.title,
        messages: [],
        createdAt: new Date(response.data.created_at),
        attachedDocuments: [],
        isFavorite: response.data.is_favorite || false,
        patientId: response.data.patient_id || patientToUse.id
      }
      console.log('New chat object:', newChat)
      setChats([newChat])
      setActiveChatId(newChat.id)
      // Load messages for the new chat
      await loadChatMessages(newChat.id)
    } catch (error) {
      console.error('Error creating patient chat:', error)
      console.error('Error details:', error.response?.data)
      alert(`Failed to create chat: ${error.response?.data?.detail || error.message}`)
    }
  }
  
  const filteredPatients = patients.filter(patient => {
    const searchLower = patientSearchQuery.toLowerCase()
    return patient.name.toLowerCase().includes(searchLower) || 
           patient.id.toLowerCase().includes(searchLower) ||
           (patient.email && patient.email.toLowerCase().includes(searchLower))
  })
  
  const handleCreatePatient = async (e) => {
    e.preventDefault()
    if (!authToken) {
      alert('Please log in to create patients')
      return
    }
    
    if (!newPatient.id || !newPatient.name) {
      alert('Patient ID and Name are required')
      return
    }
    
    try {
      // Convert empty strings to null for optional fields
      const patientData = {
        id: newPatient.id.trim(),
        name: newPatient.name.trim(),
        email: newPatient.email.trim() || null,
        phone: newPatient.phone.trim() || null,
        date_of_birth: newPatient.date_of_birth || null,
        gender: newPatient.gender || null,
        address: newPatient.address.trim() || null,
        medical_history: newPatient.medical_history.trim() || null,
        dental_history: newPatient.dental_history.trim() || null,
        allergies: newPatient.allergies.trim() || null,
        medications: newPatient.medications.trim() || null,
        summary: newPatient.summary.trim() || null
      }
      
      console.log('Creating patient with data:', patientData)
      console.log('API URL:', `${API_BASE_URL}/api/patients`)
      
      const response = await axios.post(
        `${API_BASE_URL}/api/patients`,
        patientData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      
      // Add to patients list and sort
      setPatients(prevPatients => [...prevPatients, response.data].sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ))
      
      // Reset form
      setNewPatient({
        id: '',
        name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: '',
        medical_history: '',
        dental_history: '',
        allergies: '',
        medications: '',
        summary: ''
      })
      setShowAddPatientForm(false)
      
      // Select the newly created patient
      setSelectedPatient(response.data)
      
      // Automatically create a chat for the new patient
      try {
        const chatResponse = await axios.post(
          `${API_BASE_URL}/api/chats`,
          { title: `Chat with ${response.data.name}`, patient_id: response.data.id },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
        const newChat = {
          id: chatResponse.data.id.toString(),
          title: chatResponse.data.title,
          messages: [],
          createdAt: new Date(chatResponse.data.created_at),
          attachedDocuments: [],
          isFavorite: chatResponse.data.is_favorite || false,
          patientId: chatResponse.data.patient_id
        }
        setChats([newChat])
        setActiveChatId(newChat.id)
      } catch (chatError) {
        console.error('Error creating initial chat for patient:', chatError)
        // Don't fail the whole operation if chat creation fails
      }
    } catch (error) {
      console.error('Error creating patient:', error)
      console.error('Error response:', error.response)
      console.error('Error status:', error.response?.status)
      console.error('Error data:', error.response?.data)
      
      if (error.response?.status === 404) {
        alert('Backend endpoint not found. Please make sure the backend server is running and has been restarted to load the new patient endpoints.')
      } else {
        alert(`Failed to create patient: ${error.response?.data?.detail || error.message || 'Unknown error'}`)
      }
    }
  }

  const createNewChat = async (forPatient = null) => {
    // Clear uploaded image when creating new chat
    clearUploadedImage()
    
    // If forPatient is explicitly null, don't use selectedPatient
    // This allows creating a general chat even when a patient is selected
    const patientId = forPatient !== null ? (forPatient || selectedPatient?.id || null) : null
    if (!authToken) {
      // Local chat if not authenticated
      const newChat = {
        id: Date.now().toString(),
        title: patientId ? `Chat with Patient ${patientId}` : 'New Chat',
        messages: [],
        createdAt: new Date(),
        attachedDocuments: [],
        patientId: patientId
      }
      setChats([newChat, ...chats])
      setActiveChatId(newChat.id)
      setQuery('')
      return
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/chats`,
        { title: patientId ? `Chat with Patient ${patientId}` : 'New Chat', patient_id: patientId },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      const newChat = {
        id: response.data.id.toString(),
        title: response.data.title,
        messages: [],
        createdAt: new Date(response.data.created_at),
        attachedDocuments: [],
        isFavorite: response.data.is_favorite || false,
        patientId: response.data.patient_id
      }
      setChats([newChat, ...chats])
      setActiveChatId(newChat.id)
      setQuery('')
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim() || loading) return

    const queryText = query
    setQuery('')
    setLoading(true)

    // Declare chatId outside try block so it's available in catch
    let currentChatId = activeChatId

    // Create user message object
    const userMessageId = Date.now().toString()
    const userMessage = {
      id: userMessageId,
      type: 'user',
      content: queryText,
      timestamp: new Date(),
      image: uploadedImagePreview // Include image preview if available
    }

    // Create thinking placeholder for AI
    const thinkingMessageId = (Date.now() + 1).toString()
    const thinkingMessage = {
      id: thinkingMessageId,
      type: 'ai',
      content: '',
      thinking: true, // Flag to show shimmer loader
      timestamp: new Date()
    }

    // Immediately show user message and thinking placeholder
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === activeChatId) {
        const updatedMessages = [...chat.messages, userMessage, thinkingMessage]
        const newTitle = chat.messages.length === 0
          ? queryText.substring(0, 30) + (queryText.length > 30 ? '...' : '')
          : chat.title
        return { ...chat, messages: updatedMessages, title: newTitle }
      }
      return chat
    }))

    try {
      if (authToken) {
        // Ensure we have a valid chat
        if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
          // Create a new chat if we don't have a valid one
          const newChatResponse = await axios.post(
            `${API_BASE_URL}/api/chats`,
            { title: 'New Chat' },
            { headers: { Authorization: `Bearer ${authToken}` } }
          )
          const newChat = {
            id: newChatResponse.data.id.toString(),
            title: newChatResponse.data.title,
            messages: [],
            createdAt: new Date(newChatResponse.data.created_at)
          }
          setChats([newChat, ...chats])
          setActiveChatId(newChat.id)
          currentChatId = newChat.id
        }

        // Use chat endpoint for authenticated users
        const requestData = {
          query: queryText,
          patient_id: patientId || null,
          model_provider: modelProvider
        }
        
        // Include image data if an image was uploaded
        if (uploadedImage) {
          requestData.image_data = uploadedImage
          console.log('[DEBUG] Sending image with query. Image data length:', uploadedImage.length)
        } else {
          console.log('[DEBUG] No image data to send')
        }
        
        const response = await axios.post(
          `${API_BASE_URL}/api/chats/${currentChatId}/messages`,
          requestData,
          { headers: { Authorization: `Bearer ${authToken}` } }
        )

        // Replace thinking message with actual AI response
        const aiMessage = {
          id: response.data.ai_message.id,
          type: 'ai',
          content: response.data.ai_message.content,
          sources: response.data.ai_message.sources,
          timestamp: new Date()
        }
        
        // Update user message with image from backend if provided
        const userMessageFromBackend = response.data.user_message
        const userMessageImage = userMessageFromBackend.image 
          ? `data:image/jpeg;base64,${userMessageFromBackend.image}` 
          : null
        
        // Clear uploaded image after successfully sending
        clearUploadedImage()

        setChats(prevChats => prevChats.map(chat => {
          if (chat.id === currentChatId) {
            return {
              ...chat,
              messages: chat.messages.map(msg => {
                if (msg.id === thinkingMessageId) {
                  return aiMessage
                } else if (msg.id === userMessageId && userMessageImage) {
                  // Update user message with image from backend
                  return { ...msg, image: userMessageImage }
                }
                return msg
              })
            }
          }
          return chat
        }))

        // Refresh chat list to update titles, but don't reload messages for active chat
        // to preserve the correct message order
        try {
          const response = await axios.get(`${API_BASE_URL}/api/chats`, {
            headers: { Authorization: `Bearer ${authToken}` }
          })
          const chatsData = response.data.chats.map(chat => ({
            id: chat.id.toString(),
            title: chat.title,
            createdAt: new Date(chat.created_at),
            isFavorite: chat.is_favorite || false,
            patientId: chat.patient_id || null
          }))
          
          // Update chat titles without reloading messages
          setChats(prevChats => prevChats.map(prevChat => {
            const updatedChat = chatsData.find(c => c.id === prevChat.id)
            if (updatedChat) {
              return {
                ...prevChat,
                title: updatedChat.title,
                isFavorite: updatedChat.isFavorite,
                patientId: updatedChat.patientId
              }
            }
            return prevChat
          }))
        } catch (error) {
          console.error('Error refreshing chat list:', error)
        }
      } else {
        // Fallback to old query endpoint for unauthenticated users
        const response = await axios.post(`${API_BASE_URL}/api/query`, {
          query: queryText,
          patient_id: patientId || null,
          model_provider: modelProvider
        })

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: response.data.answer,
          sources: response.data.sources || [],
          timestamp: new Date()
        }

        // Replace thinking message with actual AI response
        setChats(prevChats => prevChats.map(chat => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              messages: chat.messages.map(msg =>
                msg.id === thinkingMessageId ? aiMessage : msg
              )
            }
          }
          return chat
        }))
      }

      // Refresh history
      loadRecentQueries()
      if (patientId) {
        loadPatientHistory()
      }
    } catch (error) {
      console.error('Error querying:', error)
      const errorDetail = error.response?.data?.detail || error.message || 'Unknown error'
      console.error('Error details:', errorDetail)
      
      // Clear uploaded image on error
      clearUploadedImage()

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, there was an error processing your query: ${errorDetail}. Please try again.`,
        isError: true,
        timestamp: new Date()
      }

      // Replace thinking message with error message
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId || chat.id === currentChatId) {
          return {
            ...chat,
            messages: chat.messages.map(msg =>
              msg.id === thinkingMessageId ? errorMessage : msg
            )
          }
        }
        return chat
      }))
    } finally {
      setLoading(false)
    }
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
          ...(authToken && { Authorization: `Bearer ${authToken}` })
        },
      })

      const documentInfo = {
        filename: response.data.filename,
        title: uploadTitle || response.data.filename,
        chunks: response.data.chunks,
        uploadedAt: new Date()
      }

      // Add document to active chat
      setChats(prevChats => prevChats.map(chat => 
        chat.id === activeChatId 
          ? { 
              ...chat, 
              attachedDocuments: [...(chat.attachedDocuments || []), documentInfo]
            }
          : chat
      ))

      setUploadStatus(`✓ Successfully uploaded ${response.data.filename}! Ingested ${response.data.chunks} chunks.`)
      setUploadFile(null)
      setUploadTitle('')
      
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Reset the input so the same file can be selected again
    e.target.value = ''

    // Check if it's an image file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, PNG, GIF, or BMP)')
      return
    }

    try {
      setUploading(true)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedImagePreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Upload to backend
      const formData = new FormData()
      formData.append('file', file)
      if (selectedPatient?.id) {
        formData.append('patient_id', selectedPatient.id)
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/upload-image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(authToken && { Authorization: `Bearer ${authToken}` })
          }
        }
      )

      // Store base64 image data for sending with queries
      console.log('Image uploaded, storing base64 data. Length:', response.data.image_data?.length)
      setUploadedImage(response.data.image_data)
      setUploadStatus(`✓ X-ray uploaded: ${response.data.filename}`)
      
      setTimeout(() => {
        setUploadStatus('')
      }, 3000)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(`Error uploading image: ${error.response?.data?.detail || error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const clearUploadedImage = () => {
    setUploadedImage(null)
    setUploadedImagePreview(null)
  }

  // Route handling
  if (currentView === 'landing') {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  // Default: show chat

  return (
    <div className="app">
      {/* Left Sidebar */}
      <div className="left-sidebar">
        <button 
          className="sidebar-icon-btn" 
          onClick={() => {
            // Clear selected patient when creating a new general chat
            setSelectedPatient(null)
            createNewChat(null)
          }} 
          title="New Chat"
        >
          <div className="icon-circle">
            <Plus size={20} />
          </div>
        </button>
        <button 
          className={`sidebar-icon-btn ${currentLeftTab === 'patients' ? 'active' : ''}`}
          onClick={() => setCurrentLeftTab(currentLeftTab === 'patients' ? null : 'patients')}
          title="Patient History"
        >
          <User size={18} />
        </button>
        <button 
          className={`sidebar-icon-btn ${currentLeftTab === 'collections' ? 'active' : ''}`}
          onClick={() => setCurrentLeftTab(currentLeftTab === 'collections' ? null : 'collections')}
          title="Collections"
        >
          <Grid3x3 size={18} />
        </button>
        <button 
          className={`sidebar-icon-btn ${currentLeftTab === 'files' ? 'active' : ''}`}
          onClick={() => setCurrentLeftTab(currentLeftTab === 'files' ? null : 'files')}
          title="Files"
        >
          <Folder size={18} />
        </button>
        <button 
          className={`sidebar-icon-btn ${currentLeftTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setCurrentLeftTab(currentLeftTab === 'feedback' ? null : 'feedback')}
          title="Feedback"
        >
          <Smile size={18} />
        </button>
        <button 
          className={`sidebar-icon-btn ${currentLeftTab === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentLeftTab(currentLeftTab === 'settings' ? null : 'settings')}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Left Sidebar Content Panels */}
      {currentLeftTab && (
        <div 
          className="left-sidebar-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sidebar-panel-header">
            <h3>
              {currentLeftTab === 'patients' && 'Patient History'}
              {currentLeftTab === 'collections' && 'Collections'}
              {currentLeftTab === 'files' && 'Files & Documents'}
              {currentLeftTab === 'feedback' && 'Feedback'}
              {currentLeftTab === 'settings' && 'Settings'}
            </h3>
            <button className="close-panel-btn" onClick={() => setCurrentLeftTab(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="sidebar-panel-content">
            {currentLeftTab === 'patients' && (
              <div className="patients-panel">
                {!showAddPatientForm ? (
                  <>
                    <div className="patient-search-wrapper">
                      <Search size={16} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search by name or ID..."
                        value={patientSearchQuery}
                        onChange={(e) => setPatientSearchQuery(e.target.value)}
                        className="patient-search-input"
                      />
                    </div>
                    <div className="patients-list">
                      {filteredPatients.length === 0 ? (
                        <div className="no-patients">
                          <p>No patients found. {patientSearchQuery && 'Try a different search.'}</p>
                        </div>
                      ) : (
                        filteredPatients.map((patient) => (
                          <div
                            key={patient.id}
                            className={`patient-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                            onClick={() => handleSelectPatient(patient)}
                          >
                            <div className="patient-item-info">
                              <div className="patient-name">{patient.name}</div>
                              <div className="patient-id">ID: {patient.id}</div>
                            </div>
                            <ChevronRight size={16} className="patient-arrow" />
                          </div>
                        ))
                      )}
                    </div>
                    <button 
                      className="add-patient-btn" 
                      onClick={() => setShowAddPatientForm(true)}
                    >
                      <Plus size={16} />
                      Add New Patient
                    </button>
                    {selectedPatient && (
                      <button className="new-patient-chat-btn" onClick={handleCreatePatientChat}>
                        <Plus size={16} />
                        New Chat with {selectedPatient.name}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="add-patient-form-panel">
                    <div className="form-header">
                      <h4>Add New Patient</h4>
                      <button 
                        className="close-form-btn"
                        onClick={() => {
                          setShowAddPatientForm(false)
                          setNewPatient({
                            id: '',
                            name: '',
                            email: '',
                            phone: '',
                            date_of_birth: '',
                            gender: '',
                            address: '',
                            medical_history: '',
                            dental_history: '',
                            allergies: '',
                            medications: '',
                            summary: ''
                          })
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleCreatePatient} className="patient-form">
                      <div className="form-group">
                        <label>Patient ID <span className="required">*</span></label>
                        <input
                          type="text"
                          value={newPatient.id}
                          onChange={(e) => setNewPatient({...newPatient, id: e.target.value})}
                          placeholder="e.g., P001"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Name <span className="required">*</span></label>
                        <input
                          type="text"
                          value={newPatient.name}
                          onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                          placeholder="Full name"
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={newPatient.email}
                            onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="form-group">
                          <label>Phone</label>
                          <input
                            type="tel"
                            value={newPatient.phone}
                            onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                            placeholder="+1234567890"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Date of Birth</label>
                          <input
                            type="date"
                            value={newPatient.date_of_birth}
                            onChange={(e) => setNewPatient({...newPatient, date_of_birth: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Gender</label>
                          <select
                            value={newPatient.gender}
                            onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                          >
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <textarea
                          value={newPatient.address}
                          onChange={(e) => setNewPatient({...newPatient, address: e.target.value})}
                          placeholder="Street address, City, State, ZIP"
                          rows="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Summary</label>
                        <textarea
                          value={newPatient.summary}
                          onChange={(e) => setNewPatient({...newPatient, summary: e.target.value})}
                          placeholder="Brief patient summary..."
                          rows="3"
                        />
                      </div>
                      <div className="form-group">
                        <label>Medical History</label>
                        <textarea
                          value={newPatient.medical_history}
                          onChange={(e) => setNewPatient({...newPatient, medical_history: e.target.value})}
                          placeholder="Past medical conditions, surgeries, etc."
                          rows="3"
                        />
                      </div>
                      <div className="form-group">
                        <label>Dental History</label>
                        <textarea
                          value={newPatient.dental_history}
                          onChange={(e) => setNewPatient({...newPatient, dental_history: e.target.value})}
                          placeholder="Previous dental treatments, procedures, etc."
                          rows="3"
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Allergies</label>
                          <textarea
                            value={newPatient.allergies}
                            onChange={(e) => setNewPatient({...newPatient, allergies: e.target.value})}
                            placeholder="Known allergies"
                            rows="2"
                          />
                        </div>
                        <div className="form-group">
                          <label>Medications</label>
                          <textarea
                            value={newPatient.medications}
                            onChange={(e) => setNewPatient({...newPatient, medications: e.target.value})}
                            placeholder="Current medications"
                            rows="2"
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => {
                          setShowAddPatientForm(false)
                          setNewPatient({
                            id: '',
                            name: '',
                            email: '',
                            phone: '',
                            date_of_birth: '',
                            gender: '',
                            address: '',
                            medical_history: '',
                            dental_history: '',
                            allergies: '',
                            medications: '',
                            summary: ''
                          })
                        }}>
                          Cancel
                        </button>
                        <button type="submit" className="submit-btn">
                          Create Patient
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
            {currentLeftTab === 'collections' && (
              <div className="collections-panel">
                <h4>Your Collections</h4>
                <p>Organize your saved queries and documents into collections for easy access.</p>
                <div className="collection-list">
                  <div className="collection-item-panel">
                    <Folder size={16} />
                    <span>Recent Queries</span>
                  </div>
                  <div className="collection-item-panel">
                    <Folder size={16} />
                    <span>Patient History</span>
                  </div>
                </div>
                <button className="create-collection-btn">
                  <Plus size={16} />
                  Create New Collection
                </button>
              </div>
            )}
            {currentLeftTab === 'files' && (
              <div className="files-panel">
                <h4>Uploaded Documents</h4>
                <p>Manage your uploaded dental guidelines and reference documents.</p>
                <button className="upload-doc-btn" onClick={() => {
                  setShowUpload(true)
                  setCurrentLeftTab(null)
                }}>
                  <Upload size={16} />
                  Upload New Document
                </button>
                <div className="files-list">
                  <p className="empty-state">No documents uploaded yet. Upload your first document to get started.</p>
                </div>
              </div>
            )}
            {currentLeftTab === 'feedback' && (
              <div className="feedback-panel">
                <h4>Send Feedback</h4>
                <p>Help us improve DentalGPT by sharing your thoughts and suggestions.</p>
                <form className="feedback-form-panel" onSubmit={(e) => {
                  e.preventDefault()
                  alert('Thank you for your feedback!')
                }}>
                  <textarea
                    placeholder="Your feedback..."
                    rows="6"
                    className="feedback-textarea"
                  ></textarea>
                  <button type="submit" className="submit-feedback-btn">
                    <Send size={16} />
                    Send Feedback
                  </button>
                </form>
              </div>
            )}
            {currentLeftTab === 'settings' && (
              <div className="settings-panel">
                <h4>Settings</h4>
                <div className="settings-section">
                  <h5>Account</h5>
                  <div className="setting-item">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled />
                  </div>
                  <div className="setting-item">
                    <label>Name</label>
                    <input type="text" value={user?.name || ''} disabled />
                  </div>
                </div>
                <div className="settings-section">
                  <h5>AI Model</h5>
                  <div className="setting-item">
                    <label>Model Provider</label>
                    <select
                      value={modelProvider}
                      onChange={(e) => setModelProvider(e.target.value)}
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="gemini">Gemini (Cloud)</option>
                      <option value="glm">GLM-4.5 (Zhipu AI)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Current LLM</label>
                    <select disabled>
                      <option>
                        {modelProvider === 'gemini' ? 'gemini-1.5-flash' : 
                         modelProvider === 'glm' ? 'glm-4' : 'llama3.2:3b'}
                      </option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Embedding Model</label>
                    <select disabled>
                      <option>
                        {modelProvider === 'gemini' ? 'text-embedding-004' : 
                         modelProvider === 'glm' ? 'embedding-2' : 'nomic-embed-text'}
                        }
                      </option>
                    </select>
                  </div>
                </div>
                <div className="settings-section">
                  <h5>Preferences</h5>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Enable voice recording
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Show source citations
                    </label>
                  </div>
                </div>
                <div className="settings-section">
                  <button className="logout-btn-settings" onClick={handleLogout}>
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div 
        className="main-content-area"
        onClick={() => {
          // Close left sidebar panel when clicking on main content
          if (currentLeftTab) {
            setCurrentLeftTab(null)
          }
        }}
      >
        {/* Header */}
        <div className="main-header">
          <div className="header-left">
            <span 
              className="app-name clickable" 
              onClick={handleRefresh}
              title="Refresh chats and patients"
              style={{ cursor: 'pointer' }}
            >
              DentalGPT
            </span>
            {user && (
              <div className="user-info">
                <img src={user.picture_url} alt={user.name} className="user-avatar" />
                <div className="user-name-dropdown">
                  <span 
                    className="user-name" 
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    style={{ cursor: 'pointer' }}
                  >
                    {user.name}
                  </span>
                  {showUserDropdown && (
                    <div className="user-dropdown-menu">
                      <div 
                        className="user-dropdown-item"
                        onClick={() => {
                          setShowUserDropdown(false)
                          setCurrentLeftTab('settings')
                        }}
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </div>
                      <div 
                        className="user-dropdown-item"
                        onClick={() => {
                          setShowUserDropdown(false)
                          handleLogout()
                        }}
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="header-arrow" onClick={() => setShowRightSidebar(!showRightSidebar)}>
            <ChevronRight size={20} className={showRightSidebar ? 'rotated' : ''} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {/* Show attached documents */}
          {activeChat.attachedDocuments && activeChat.attachedDocuments.length > 0 && (
            <div className="attached-documents-section">
              <div className="attached-documents-header">
                <FileText size={16} />
                <span>Attached Documents ({activeChat.attachedDocuments.length})</span>
              </div>
              <div className="attached-documents-list">
                {activeChat.attachedDocuments.map((doc, idx) => (
                  <div key={idx} className="attached-document-item">
                    <FileText size={14} />
                    <div className="document-info">
                      <span className="document-title">{doc.title}</span>
                      <span className="document-meta">{doc.chunks} chunks • {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeChat.messages.length === 0 ? (
            <div className="empty-chat">
              <p className="empty-chat-text">Ask DentalGPT anything...</p>
              <div className="example-questions">
                {exampleQuestions.slice(0, 3).map((example, idx) => (
                  <button
                    key={idx}
                    className="example-question-btn"
                    onClick={() => setQuery(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-container">
              {activeChat.messages.map((message) => (
                <div key={message.id} className={`message ${message.type} ${message.thinking ? 'thinking' : ''} ${message.isError ? 'error' : ''}`}>
                  {message.image && (
                    <div className="message-image">
                      <img src={message.image} alt="Uploaded X-ray" />
                    </div>
                  )}
                  <div className="message-content">
                    {message.thinking ? (
                      <div className="thinking-text">thinking...</div>
                    ) : message.type === 'ai' ? (
                      renderFormattedContent(message.content)
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.timestamp && !message.thinking && (
                    <div className="message-timestamp">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  )}
                  {message.type === 'ai' && !message.thinking && message.sources && message.sources.length > 0 && (
                    <div className="message-sources">
                      <details className="sources-details">
                        <summary>Sources ({message.sources.length})</summary>
                        <div className="sources-list">
                          {message.sources.map((source, idx) => (
                            <div key={idx} className="source-item">
                              <div className="source-header">
                                <span>Source {idx + 1}</span>
                                <span className="source-score">{(source.score * 100).toFixed(1)}%</span>
                              </div>
                              <div className="source-text">{source.text}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Section (when shown) */}
        {showUpload && (
          <div className="upload-overlay">
            <div className="upload-modal">
              <div className="upload-header">
                <h3>Upload Document</h3>
                <button className="close-btn" onClick={() => setShowUpload(false)}>
                  <X size={20} />
                </button>
              </div>
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
                <input
                  type="text"
                  placeholder="Document Title (optional)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="title-input"
                  disabled={uploading}
                />
                <button 
                  type="submit" 
                  className="upload-submit-button"
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? 'Uploading...' : 'Upload & Ingest'}
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

        {/* Voice Visualizer (shown when recording or thinking) */}
        {(voiceState === 'recording' || voiceState === 'thinking') && (
          <div className="voice-visualizer-container">
            <div className="voice-visualizer-content">
              <LiveWaveform
                active={voiceState === 'recording'}
                processing={voiceState === 'thinking'}
                height={50}
                barWidth={3}
                barGap={2}
                mode="static"
                fadeEdges={true}
                barColor={voiceState === 'recording' ? '#4CAF50' : '#2196F3'}
                historySize={60}
                audioStream={audioStream}
              />
              <div className="voice-status-text">
                {voiceState === 'recording' && 'Listening...'}
                {voiceState === 'thinking' && 'Processing...'}
              </div>
              {voiceState === 'recording' && (
                <button
                  className="stop-recording-btn"
                  onClick={stopVoiceRecording}
                  title="Stop Recording"
                >
                  <MicOff size={14} />
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          {/* Show document indicator when typing */}
          {activeChat.attachedDocuments && activeChat.attachedDocuments.length > 0 && query.length > 0 && (
            <div className="document-indicator">
              <FileText size={14} />
              <span>Reading from {activeChat.attachedDocuments.length} document{activeChat.attachedDocuments.length > 1 ? 's' : ''}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="input-form">
            <button 
              type="button" 
              className="attach-btn"
              onClick={() => setShowUpload(true)}
              title="Upload Document"
            >
              <Paperclip size={20} />
            </button>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/bmp"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="xray-upload-input"
              disabled={uploading}
            />
            <label 
              htmlFor="xray-upload-input" 
              className="attach-btn xray-btn"
              title="Upload X-ray"
              style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
            >
              <Upload size={20} />
            </label>
            {uploadedImagePreview && (
              <div className="uploaded-image-preview">
                <img src={uploadedImagePreview} alt="X-ray preview" />
                <button 
                  type="button"
                  className="remove-image-btn"
                  onClick={clearUploadedImage}
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask DentalGPT anything..."
              className="chat-input"
              disabled={loading}
            />
            <button
              type="button"
              className={`voice-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
            >
              {isRecording ? (
                <>
                  <MicOff size={20} />
                  <span className="recording-indicator"></span>
                </>
              ) : (
                <Mic size={20} />
              )}
            </button>
            <button 
              type="submit" 
              className="send-btn"
              disabled={loading || !query.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div 
          className="right-sidebar"
          onClick={() => {
            // Close left sidebar panel when clicking on right sidebar
            if (currentLeftTab) {
              setCurrentLeftTab(null)
            }
          }}
        >
          {/* Patient Summary Panel */}
          {selectedPatient && (
            <div className="patient-summary-panel">
              <div className="patient-summary-header">
                <h3>Patient Summary</h3>
                <button 
                  className="close-patient-btn"
                  onClick={() => setSelectedPatient(null)}
                  title="Close Patient View"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="patient-summary-content">
                <div className="patient-summary-info">
                  <div className="patient-summary-name">{selectedPatient.name}</div>
                  <div className="patient-summary-id">ID: {selectedPatient.id}</div>
                  {selectedPatient.email && (
                    <div className="patient-summary-field">
                      <strong>Email:</strong> {selectedPatient.email}
                    </div>
                  )}
                  {selectedPatient.phone && (
                    <div className="patient-summary-field">
                      <strong>Phone:</strong> {selectedPatient.phone}
                    </div>
                  )}
                  {selectedPatient.date_of_birth && (
                    <div className="patient-summary-field">
                      <strong>Date of Birth:</strong> {new Date(selectedPatient.date_of_birth).toLocaleDateString()}
                    </div>
                  )}
                  {selectedPatient.gender && (
                    <div className="patient-summary-field">
                      <strong>Gender:</strong> {selectedPatient.gender}
                    </div>
                  )}
                  {selectedPatient.summary && (
                    <div className="patient-summary-section">
                      <strong>Summary:</strong>
                      <p>{selectedPatient.summary}</p>
                    </div>
                  )}
                  {selectedPatient.medical_history && (
                    <div className="patient-summary-section">
                      <strong>Medical History:</strong>
                      <p>{selectedPatient.medical_history}</p>
                    </div>
                  )}
                  {selectedPatient.dental_history && (
                    <div className="patient-summary-section">
                      <strong>Dental History:</strong>
                      <p>{selectedPatient.dental_history}</p>
                    </div>
                  )}
                  {selectedPatient.allergies && (
                    <div className="patient-summary-section">
                      <strong>Allergies:</strong>
                      <p>{selectedPatient.allergies}</p>
                    </div>
                  )}
                  {selectedPatient.medications && (
                    <div className="patient-summary-section">
                      <strong>Medications:</strong>
                      <p>{selectedPatient.medications}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="sidebar-header">
            <h3>AI Module</h3>
            <div className="model-selector">
              <button
                className="model-dropdown-btn"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
              >
                <span className="model-label">
                  {modelProvider === 'gemini' ? 'Gemini' : modelProvider === 'glm' ? 'GLM-4.5' : 'Ollama'}
                </span>
                {showModelDropdown ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {showModelDropdown && (
                <div className="model-dropdown-menu">
                  <button
                    className={`model-option ${modelProvider === 'ollama' ? 'active' : ''}`}
                    onClick={() => {
                      setModelProvider('ollama')
                      setShowModelDropdown(false)
                    }}
                  >
                    <span>Ollama</span>
                    <span className="model-badge">Local</span>
                  </button>
                  <button
                    className={`model-option ${modelProvider === 'gemini' ? 'active' : ''}`}
                    onClick={() => {
                      setModelProvider('gemini')
                      setShowModelDropdown(false)
                    }}
                  >
                    <span>Gemini</span>
                    <span className="model-badge">Cloud</span>
                  </button>
                  <button
                    className={`model-option ${modelProvider === 'glm' ? 'active' : ''}`}
                    onClick={() => {
                      setModelProvider('glm')
                      setShowModelDropdown(false)
                    }}
                  >
                    <span>GLM-4.5</span>
                    <span className="model-badge">Zhipu AI</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-tabs">
              <button 
                className={`tab ${activeChatTab === 'recent' ? 'active' : ''}`}
                onClick={() => setActiveChatTab('recent')}
              >
                Recent
              </button>
              <button 
                className={`tab ${activeChatTab === 'favorite' ? 'active' : ''}`}
                onClick={() => setActiveChatTab('favorite')}
              >
                Favorite
              </button>
            </div>
            <div className="conversations-list">
              {chats
                .filter(chat => activeChatTab === 'favorite' ? chat.isFavorite : true)
                .map((chat) => (
                <div
                  key={chat.id}
                  className={`conversation-item ${chat.id === activeChatId ? 'active' : ''}`}
                >
                  {editingChatId === chat.id ? (
                    <div className="chat-edit-mode">
                      <input
                        type="text"
                        value={editingChatTitle}
                        onChange={(e) => setEditingChatTitle(e.target.value)}
                        className="chat-title-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameChat(chat.id, editingChatTitle)
                          } else if (e.key === 'Escape') {
                            setEditingChatId(null)
                            setEditingChatTitle('')
                          }
                        }}
                      />
                      <button
                        className="chat-action-btn save-btn"
                        onClick={() => handleRenameChat(chat.id, editingChatTitle)}
                        title="Save"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        className="chat-action-btn cancel-btn"
                        onClick={() => {
                          setEditingChatId(null)
                          setEditingChatTitle('')
                        }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="conversation-content"
                        onClick={() => {
                          setActiveChatId(chat.id)
                          if (authToken) {
                            loadChatMessages(chat.id)
                          }
                        }}
                      >
                        <FileText size={14} />
                        <span className="conversation-title">{chat.title}</span>
                        {chat.attachedDocuments && chat.attachedDocuments.length > 0 && (
                          <span className="document-badge" title={`${chat.attachedDocuments.length} document${chat.attachedDocuments.length > 1 ? 's' : ''} attached`}>
                            <Paperclip size={10} />
                            {chat.attachedDocuments.length}
                          </span>
                        )}
                      </div>
                      <div className="chat-actions">
                        <button
                          className={`chat-action-btn favorite-btn ${chat.isFavorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleFavorite(chat.id)
                          }}
                          title={chat.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star size={12} fill={chat.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="chat-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingChatId(chat.id)
                            setEditingChatTitle(chat.title)
                          }}
                          title="Rename"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="chat-action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${chat.title}"?`)) {
                              handleDeleteChat(chat.id)
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-header">
              <h4>Collections</h4>
              <span className="new-badge">New</span>
            </div>
            <div className="collections-list">
              {recentQueries.length > 0 && (
                <div className="collection-group">
                  <div className="collection-header">
                    <Folder size={14} />
                    <span>Recent Queries</span>
                  </div>
                  <div className="collection-items">
                    {recentQueries.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="collection-item"
                        onClick={() => {
                          createNewChat()
                          setTimeout(() => setQuery(item.query_text), 100)
                        }}
                      >
                        <Clock size={12} />
                        <span>{item.query_text.substring(0, 40)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {patientId && patientHistory.length > 0 && (
                <div className="collection-group">
                  <div className="collection-header">
                    <Folder size={14} />
                    <span>Patient History</span>
                  </div>
                  <div className="collection-items">
                    {patientHistory.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="collection-item"
                        onClick={() => {
                          createNewChat()
                          setTimeout(() => setQuery(item.query_text), 100)
                        }}
                      >
                        <FileText size={12} />
                        <span>{item.query_text.substring(0, 40)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="patient-input-wrapper">
              <label>Patient ID (Optional)</label>
              <input
                type="text"
                placeholder="Enter patient ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="patient-input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
