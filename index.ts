import { generateContext } from "./ai/generate-context"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { genText } from "./ai/ai"
import { parseArgs } from "util"
import { generateResponse } from "./ai/generate-response"
import { intersperseConsiderations } from "./ai/intersperse-considerations"

// USAGE
// bun index.ts -i inputs/bangers-and-duds.txt -l bangers-and-duds -n 50

// - run the main loop in batches in parallel, using a task runner that shows progress in the console like listr2

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: { short: 'i', type: "string", default: "inputs/mixed.txt" },
    count: { short: 'n', type: "string", default: "50" },
    label: { short: 'l', type: "string", default: "output" }
  },
  strict: true,
  allowPositionals: true,
})

const outfile = `outputs/${values.label}-${new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "").replace(/T/, "_")}.jsonl`
const count = parseInt(values.count!)
const inputFile = values.inputFile!
const lines = (await Bun.file(inputFile).text()).split('\n').splice(0, count).filter(Boolean)

console.log(`Generating ${lines.length} responses from ${inputFile}...`)

// main loop

for await (let [index, q] of lines.entries()) {
  console.log(`### Response ${index + 1}/${lines.length}`)
  console.log(`-> ${q}`)
  const context_reasoning = await generateContext(q)
  const choice_type = context_reasoning.finalChoiceType
  console.log(`Choice type: ${choice_type}`)
  console.log(`Generating value...`)
  const value_reasoning = await generateValue(q, choice_type)
  const policies = value_reasoning.revisedAttentionPolicies
  console.log(`Generating response...`)
  const response_reasoning = await generateResponse(q, choice_type, policies)
  const response = response_reasoning.finalResponse

  console.log(`Generating naive response...`)
  const naive_response = await genText({
    prompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
    userMessage: q
  })

  console.log(`Interspersing considerations into response...`)
  const response_with_considerations = (await intersperseConsiderations(q, response, choice_type, policies)).response

  console.log(`Done!\n\n\n`)

  await appendFile(
    outfile,
    JSON.stringify({
      q,
      choice_type,
      policies,
      response,
      naive_response,
      response_with_considerations,
      reasoning: { context_reasoning, value_reasoning, response_reasoning },
    }) + "\n"
  )
}
