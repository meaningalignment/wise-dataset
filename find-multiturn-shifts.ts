import { appendFile } from "node:fs/promises"
import { parseArgs } from "util"
import { embed } from "./ai/ai" // Make sure this import is correct

// Example usage:
// bun run filter -- -i inputs/cai-harmless.jsonl -n 250 -s 1000

const outfile = `outputs/filter-${new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace(/\..+/, "")
  .replace(/T/, "_")}.jsonl`

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: {
      short: "i",
      type: "string",
      default: "inputs/mixed.jsonl",
    },
    count: {
      short: "n",
      type: "string",
      default: "all",
    },
  },
  strict: true,
  allowPositionals: true,
})

const inputFile = values.inputFile!
const lines = (await Bun.file(inputFile).text()).split("\n").filter(Boolean)
const count = values.count === "all" ? lines.length : parseInt(values.count!)

console.log(`Processing ${lines.length}/${count} lines from ${inputFile}...`)

function cosineDistance(vecA: number[], vecB: number[]) {
  let dotProduct = 0.0
  let normA = 0.0
  let normB = 0.0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return 1.0 - dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Prepare all choice types for batch embedding
const allChoiceTypes = lines.flatMap((line) => {
  const { reasoning } = JSON.parse(line)
  return [
    reasoning.reasoning[0].context.finalChoiceType,
    reasoning.reasoning[1].context.finalChoiceType,
  ]
})

// Batch embed all choice types
console.log("Embedding all choice types...")
const allEmbeddings = await embed(allChoiceTypes)

for await (let [index, line] of lines.entries()) {
  if (index >= count) break // Stop processing after 'count' lines

  const { reasoning, conversations } = JSON.parse(line)

  const pattern = /<value[^>]*>|<\/value>/g
  const prompt = conversations[0].content.replace(pattern, "")
  const userResponse = conversations[2].content.replace(pattern, "")

  const choiceType1 = reasoning.reasoning[0].context.finalChoiceType
  const choiceType2 = reasoning.reasoning[1].context.finalChoiceType

  console.log(`### Processing line ${index + 1}/${count}`)

  const embedding1 = allEmbeddings[index * 2]
  const embedding2 = allEmbeddings[index * 2 + 1]
  const contextRequiredLikelihood = cosineDistance(embedding1, embedding2)

  await appendFile(
    outfile,
    JSON.stringify({
      prompt,
      userResponse,
      choiceType1,
      choiceType2,
      contextRequiredLikelihood,
    }) + "\n"
  )
}
