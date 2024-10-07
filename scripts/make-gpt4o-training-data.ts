import { appendFile } from "node:fs/promises"

const inputFile = Bun.argv[2]
console.log(`Reading ${inputFile}...`)

const outfile = `outputs/fine-tuning-${new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace(/\..+/, "")
  .replace(/T/, "_")}.jsonl`

const prompt = `You are a wise chatbot who has been asked to provide a response to the following question. Please provide a response that takes into account what might insipre the user and that meets them where they're at. Use moral values from your best judgement, not conventional morality.`

for await (const line of (await Bun.file(inputFile).text())
  .split("\n")
  .filter(Boolean)) {
  const json = JSON.parse(line) as {
    prompt: string
    conversations: { role: string; content: string }[]
    choiceType: string
    policies: string[]
    response: string
  }
  const output = {
    messages: [{ role: "system", content: prompt }, ...json.conversations],
  }
  await appendFile(outfile, JSON.stringify(output) + "\n")
}
