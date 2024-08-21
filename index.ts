import { generateContext } from "./ai/generate-context"
import { generateResponse } from "./ai/generate-response"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { genText } from "./ai/ai"
import { parseArgs } from "util"

const outfile = `outputs/${new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "").replace(/T/, "_")}.jsonl`

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: {
      short: 'i',
      type: "string",
      default: "inputs/mixed.txt",
    },
    count: {
      short: 'n',
      type: "string",
      default: "50",
    },
  },
  strict: true,
  allowPositionals: true,
})

const count = parseInt(values.count!)
const inputFile = values.inputFile!
const lines = (await Bun.file(inputFile).text()).split('\n').splice(0, count)

console.log(`Generating ${count} responses from ${inputFile}...`)

for await (let [index, q] of lines.entries()) {
  console.log(`### Response ${index + 1}/${count}`)
  console.log(`-> ${q}`)
  const context_reasoning = await generateContext(q)
  const choiceType = context_reasoning.finalChoiceType
  console.log(`Choice type: ${choiceType}`)
  console.log(`Generating value...`)
  const value_reasoning = await generateValue(q, choiceType)
  const policies = value_reasoning.revisedAttentionPolicies
  console.log(`Generating response...`)
  const response_reasoning = await generateResponse(q, choiceType, policies)
  const response = response_reasoning.finalResponse

  console.log(`Generating naive response...`)
  const naive_response = await genText({
    prompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
    userMessage: q
  })

  console.log(`Done!\n\n\n`)
  await appendFile(outfile, JSON.stringify({
    q, choiceType, policies, response, naive_response, reasoning: { context_reasoning, value_reasoning, response_reasoning }
  }) + '\n')
}
