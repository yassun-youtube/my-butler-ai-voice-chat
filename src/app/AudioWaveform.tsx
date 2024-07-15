import React, { useCallback, useEffect, useRef, useState } from "react"
import * as WaveFile from "wavefile"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

type Props = {
  changeSpeakingState: (_isSpeaking: boolean) => void
}
const AudioWaveform = ({ changeSpeakingState }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [recordings, setRecordings] = useState<string[]>([])

  const silentCountRef = useRef<number>(0)
  const isSpeakingRef = useRef<boolean>(false)

  const handleSendToWhisperRef = useRef<(audioUrl: string) => Promise<void>>()
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    console.log(messages)
  }, [messages])

  function startSpeaking() {
    if (!mediaRecorderRef.current) return

    console.log("startSpeaking")
    isSpeakingRef.current = true
    changeSpeakingState(true)
    if (mediaRecorderRef.current?.state !== "recording") {
      mediaRecorderRef.current?.start()
    }
  }

  function stopSpeaking() {
    console.log("stopSpeaking")
    isSpeakingRef.current = false
    changeSpeakingState(false)
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  handleSendToWhisperRef.current = async (audioUrl: string) => {
    const blob = await ffmpegExec(audioUrl)
    const formData = new FormData()
    formData.append("file", blob, "audio.wav")
    formData.append("model", "whisper-1")

    const response = await fetch("/api/whisper", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()
    console.log(data)

    if (data.text) {
      const myMessages = [...messages, { role: "user", content: data.text }]

      const response = await fetch("/api/chatgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: myMessages,
        }),
      })
      const butlerMessage = await response.json()
      if (butlerMessage.response.message) {
        setMessages((prevMessages) => [
          ...myMessages,
          butlerMessage.response.message,
        ])
        console.log(butlerMessage)

        const audioResponse = await fetch("/api/textspeech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: butlerMessage.response.message.content,
          }),
        })
        const audioResponseJson = await audioResponse.json()
        const url = `data:audio/mp3;base64,${audioResponseJson.audio}`
        console.log(url)
        const audio = new Audio(url)
        await audio.play()
      }
    }
  }

  const ffmpegExec = async (audioUrl: string) => {
    const ffmpeg = new FFmpeg()
    await ffmpeg.load()
    await ffmpeg.writeFile("input.webm", await fetchFile(audioUrl))
    await ffmpeg.exec(["-i", "input.webm", "audio.wav"])
    const fileData = await ffmpeg.readFile("audio.wav")
    const data = new Uint8Array(fileData as ArrayBuffer)
    return new Blob([data.buffer], { type: "audio/mp3" })
  }

  const showAudioWaveform = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasCtx = canvas.getContext("2d")
    if (!canvasCtx) return

    audioContextRef.current = new window.AudioContext()
    analyserRef.current = audioContextRef.current.createAnalyser()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream)
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)

      // Highpassフィルタを作成（300 Hz以下の周波数をカット）
      const highpassFilter = audioContextRef.current.createBiquadFilter()
      highpassFilter.type = "highpass"
      highpassFilter.frequency.value = 300

      // Lowpassフィルタを作成（3400 Hz以上の周波数をカット）
      const lowpassFilter = audioContextRef.current.createBiquadFilter()
      lowpassFilter.type = "lowpass"
      lowpassFilter.frequency.value = 3400

      highpassFilter.connect(analyserRef.current)
      lowpassFilter.connect(analyserRef.current)

      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current)
        const audioUrl = URL.createObjectURL(audioBlob)
        if (handleSendToWhisperRef.current)
          handleSendToWhisperRef.current(audioUrl)

        setRecordings((prevRecordings) => [...prevRecordings, audioUrl])
        audioChunksRef.current = []
        if (mediaRecorderRef.current?.state !== "recording") {
          mediaRecorderRef.current?.start()
        }
      }

      analyserRef.current.fftSize = 2048
      const bufferLength = analyserRef.current.fftSize
      const dataArray = new Uint8Array(bufferLength)

      canvas.width = window.innerWidth
      canvas.height = 150

      const draw = () => {
        if (!analyserRef.current) return

        requestAnimationFrame(draw)

        analyserRef.current.getByteTimeDomainData(dataArray)

        const maxAbs = Math.max(
          ...dataArray.map((value) => Math.abs(value - 128)),
        )

        if (maxAbs > 15) {
          silentCountRef.current = 0
          if (!isSpeakingRef.current) {
            startSpeaking()
          }
        } else {
          silentCountRef.current += 1
        }

        if (silentCountRef.current > 90) {
          if (isSpeakingRef.current) {
            stopSpeaking()
          }
          // console.log("silentCountRef: ", silentCountRef.current)
        }
        // console.log("isSpeaking", isSpeakingRef.current)

        canvasCtx.fillStyle = "rgb(200, 200, 200)"
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

        canvasCtx.lineWidth = 2
        canvasCtx.strokeStyle = "rgb(0, 0, 0)"

        canvasCtx.beginPath()

        const sliceWidth = (canvas.width * 1.0) / bufferLength
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * canvas.height) / 2

          if (i === 0) {
            canvasCtx.moveTo(x, y)
          } else {
            canvasCtx.lineTo(x, y)
          }

          x += sliceWidth
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2)
        canvasCtx.stroke()
      }

      draw()
    } catch (err) {
      console.error("Error accessing microphone:", err)
    }
  }

  return (
    <div className={"flex flex-col items-center"}>
      <button
        onClick={showAudioWaveform}
        className={
          "font-bold text-white text-3xl rounded-3xl bg-blue-500 p-8 hover:bg-blue-700"
        }
      >
        AI執事と話す
      </button>
      <canvas ref={canvasRef} />
      <ul>
        {recordings.map((recording, index) => (
          <li key={index}>
            <audio src={recording} controls />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AudioWaveform
