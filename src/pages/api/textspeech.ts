import OpenAI from "openai"
import fs from "fs"
import path from "path"
import { NextApiRequest, NextApiResponse } from "next"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("start textspeech!!!")
  if (req.method === "POST") {
    const { text } = req.body

    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      })
      const audioBuffer = Buffer.from(await response.arrayBuffer())
      const base64Audio = audioBuffer.toString("base64")

      res.status(200).json({ audio: base64Audio })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "Internal Server Error" })
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" })
  }
}
