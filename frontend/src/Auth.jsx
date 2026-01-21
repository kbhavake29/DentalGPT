import React, { useEffect, useState } from 'react'
import axios from 'axios'
import './Auth.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Auth({ onAuthSuccess }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    // Load Google script but don't render button - we'll use our own button
    if (window.google) {
      return // Already loaded
    }

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existingScript) {
      return // Already loading/loaded
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [])

  const handleGoogleSignIn = () => {
    if (!clientId) {
      setError('Google Client ID not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    // Wait for Google script to load
    const checkGoogle = () => {
      if (window.google && window.google.accounts) {
        try {
          // Use OAuth2 popup flow - this doesn't manipulate React's DOM
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            redirect_uri: window.location.origin, // Match your Google Console settings
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                setError(tokenResponse.error)
                setIsLoading(false)
                return
              }

              if (tokenResponse.access_token) {
                try {
                  const result = await axios.post(`${API_BASE_URL}/api/auth/google`, {
                    access_token: tokenResponse.access_token
                  })

                  localStorage.setItem('auth_token', result.data.token)
                  localStorage.setItem('user', JSON.stringify(result.data.user))
                  onAuthSuccess(result.data.user, result.data.token)
                } catch (error) {
                  console.error('Authentication error:', error)
                  setError(error.response?.data?.detail || 'Authentication failed. Please try again.')
                  setIsLoading(false)
                }
              } else {
                setError('Failed to get access token')
                setIsLoading(false)
              }
            }
          })

          client.requestAccessToken()
        } catch (error) {
          console.error('Error initiating sign-in:', error)
          setError('Failed to start sign-in. Please try again.')
          setIsLoading(false)
        }
      } else {
        // Wait a bit and try again
        setTimeout(checkGoogle, 100)
      }
    }

    checkGoogle()
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title">Welcome to DentalGPT</h1>
        <p className="auth-subtitle">Sign in to continue</p>
        
        {error && (
          <div className="error-message">
            {error}
            <button 
              className="retry-button"
              onClick={() => {
                setError(null)
                handleGoogleSignIn()
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {!clientId ? (
          <div className="error-message">
            Google Client ID not configured.
            <br />
            <small>Please check your frontend/.env file and restart the dev server.</small>
          </div>
        ) : (
          <>
            <button 
              className="google-signin-button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <p className="auth-privacy">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default Auth
