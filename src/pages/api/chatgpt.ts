// pages/api/chatgpt.js

import OpenAI from "openai"
import { SYSTEM_PROMPT } from "@/constants/prompts"
import type { NextApiRequest, NextApiResponse } from "next"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("start chatgpt!!!")
  if (req.method !== "POST") {
    res.status(405).json({ message: "Only POST requests are allowed" })
    return
  }

  const { messages } = req.body

  // try {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  })

  res.status(200).json({ response: response.choices[0] })
  // }
  // } catch (error) {
  //   res.status(500).json({
  //     message: "Error generating response",
  //     error: (error as Error).message,
  //   })
  // }
}
