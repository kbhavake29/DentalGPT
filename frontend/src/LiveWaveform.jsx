import React, { useEffect, useRef, useState } from 'react'
import './LiveWaveform.css'

export function LiveWaveform({
  active = false,
  processing = false,
  height = 60,
  barWidth = 3,
  barGap = 2,
  mode = 'static',
  fadeEdges = true,
  barColor = '#4CAF50',
  historySize = 120,
  audioStream = null // Optional: use provided stream instead of creating new one
}) {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const streamRef = useRef(null)
  const historyRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const barCount = Math.floor(width / (barWidth + barGap))
    const bufferLength = barCount * 2 // For smoother visualization

    const draw = () => {
      if (!active && !processing) {
        // Fade out when inactive
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.fillRect(0, 0, width, height)
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillRect(0, 0, width, height)

      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current)
        
        const barData = []
        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * bufferLength)
          const value = dataArrayRef.current[dataIndex] || 0
          barData.push(value)
        }

        // Add to history for scrolling mode
        if (mode === 'scrolling') {
          historyRef.current.push(barData)
          if (historyRef.current.length > historySize) {
            historyRef.current.shift()
          }
        }

        // Draw bars
        if (mode === 'static') {
          barData.forEach((value, index) => {
            const barHeight = (value / 255) * height
            const x = index * (barWidth + barGap)
            const y = height - barHeight

            // Fade edges
            let alpha = 1
            if (fadeEdges) {
              const center = barCount / 2
              const distance = Math.abs(index - center)
              const maxDistance = barCount / 2
              alpha = 1 - (distance / maxDistance) * 0.5
            }

            ctx.fillStyle = processing ? '#2196F3' : barColor
            ctx.globalAlpha = alpha
            ctx.fillRect(x, y, barWidth, barHeight)
            ctx.globalAlpha = 1
          })
        } else {
          // Scrolling mode
          const history = historyRef.current
          const stepX = width / historySize
          
          history.forEach((barData, historyIndex) => {
            const x = historyIndex * stepX
            barData.forEach((value, barIndex) => {
              const barHeight = (value / 255) * height
              const barX = x + (barIndex * (barWidth + barGap))
              const barY = height - barHeight

              if (barX + barWidth > 0 && barX < width) {
                ctx.fillStyle = processing ? '#2196F3' : barColor
                ctx.fillRect(barX, barY, barWidth, barHeight)
              }
            })
          })
        }
      } else if (processing) {
        // Show processing animation when no audio but processing
        const time = Date.now() / 500
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(time + i * 0.2) * 0.5 + 0.5
          const barHeight = wave * height * 0.6
          const x = i * (barWidth + barGap)
          const y = height - barHeight

          ctx.fillStyle = '#2196F3'
          ctx.fillRect(x, y, barWidth, barHeight)
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [active, processing, mode, height, barWidth, barGap, fadeEdges, barColor, historySize])

  useEffect(() => {
    if (active && (audioStream || !audioStream)) {
      const initAudio = async () => {
        try {
          // Use provided stream or create new one
          const stream = audioStream || await navigator.mediaDevices.getUserMedia({ audio: true })
          if (!audioStream) {
            streamRef.current = stream // Only store if we created it
          }

          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          audioContextRef.current = audioContext

          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          analyserRef.current = analyser

          const bufferLength = analyser.frequencyBinCount
          dataArrayRef.current = new Uint8Array(bufferLength)

          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)
        } catch (error) {
          console.error('Error accessing microphone:', error)
        }
      }

      initAudio()
    } else {
      // Cleanup (only if we created the stream)
      if (streamRef.current && !audioStream) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      analyserRef.current = null
      dataArrayRef.current = null
      historyRef.current = []
    }

    return () => {
      // Only cleanup stream if we created it
      if (streamRef.current && !audioStream) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [active, audioStream])

  // Calculate canvas width based on bar count
  const barCount = Math.floor(300 / (barWidth + barGap))
  const canvasWidth = barCount * (barWidth + barGap)

  return (
    <canvas
      ref={canvasRef}
      className="live-waveform"
      width={canvasWidth}
      height={height}
    />
  )
}
