import type { NextApiRequest, NextApiResponse } from "next"
import formidable from "formidable"
import fs from "fs"
import FormData from "form-data"
import { BodyInit } from "undici-types/fetch"
import { instanceOf } from "prop-types"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const config = {
  api: {
    bodyParser: false,
  },
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log("start whisper api")
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" })
    return
  }

  const form = formidable({ multiples: false })

  form.parse(req, async (err, fields, files) => {
    console.log(files)
    if (err) {
      res.status(500).json({ message: "Error parsing form data" })
      return
    }

    if (!files.file) {
      res.status(400).json({ message: "File not provided" })
      return
    }

    const file =
      files.file instanceof Array
        ? files.file[0]
        : (files.file as formidable.File)

    const stream = fs.createReadStream(file.filepath)

    const writeStream = fs.createWriteStream("/tmp/my-butler-test.wav")

    // 読み取りストリームを書き込みストリームにパイプする
    stream.pipe(writeStream)

    writeStream.on("finish", async () => {
      console.log("File has been written to /tmp/my-butler-test.wav")
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("/tmp/my-butler-test.wav"),
        model: "whisper-1",
        language: "ja",
      })
      res.status(200).json(transcription)
    })

    writeStream.on("error", (err) => {
      console.error("Error writing file:", err)
    })

    stream.on("error", (err) => {
      console.error("Error reading file:", err)
    })
  })
}

export default handler
