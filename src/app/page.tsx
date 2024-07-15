"use client"
import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { Simulate } from "react-dom/test-utils"
import change = Simulate.change

const AudioWaveform = dynamic(() => import("./AudioWaveform"), {
  ssr: false,
})

export default function AudioRecorder() {
  useEffect(() => {
    console.log("Index.useEffect")
  })
  const [recordings, setRecordings] = useState<string[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceStartRef = useRef<number>(performance.now())

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContextRef.current = new window.AudioContext()
    analyserRef.current = audioContextRef.current.createAnalyser()

    const source = audioContextRef.current.createMediaStreamSource(stream)
    source.connect(analyserRef.current)

    mediaRecorderRef.current = new MediaRecorder(stream)
    mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
      audioChunksRef.current.push(event.data)
    }

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current)
      const audioUrl = URL.createObjectURL(audioBlob)
      setRecordings((prevRecordings) => [...prevRecordings, audioUrl])
      audioChunksRef.current = []
      if (mediaRecorderRef.current?.state !== "recording") {
        mediaRecorderRef.current?.start()
      }
    }

    mediaRecorderRef.current.start()
    silenceStartRef.current = performance.now()
    detectSilence()
  }

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  const detectSilence = () => {
    if (!analyserRef.current) return

    const array = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(array)

    const silenceThreshold = 50 // デシベルの閾値
    const silenceDuration = 1000 // 無音とみなすミリ秒数

    const isSilence = array.every((value) => value < silenceThreshold)
    if (isSilence) {
      console.log("now silence")
      // if (performance.now() - silenceStartRef.current > silenceDuration) {
      //   console.log(performance.now() - silenceStartRef.current)
      //   stopRecording()
      // }
    } else {
      silenceStartRef.current = performance.now()
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      requestAnimationFrame(detectSilence)
    }
  }

  const changeSpeakingState = (isSpeaking: boolean) => {
    console.log("isSpeaking", isSpeaking)
  }

  return (
    <div className={"w-screen h-screen flex justify-center items-center"}>
      {/*<button onClick={startRecording}>Start Recording</button>*/}
      {/*<button onClick={stopRecording}>Stop Recording</button>*/}
      {/*<ul>*/}
      {/*  {recordings.map((recording, index) => (*/}
      {/*    <li key={index}>*/}
      {/*      <audio src={recording} controls />*/}
      {/*    </li>*/}
      {/*  ))}*/}
      {/*</ul>*/}
      <AudioWaveform changeSpeakingState={changeSpeakingState} />
    </div>
  )
}
