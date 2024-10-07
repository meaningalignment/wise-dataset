import { generateChoiceType } from "./ai/generate-choice-type"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { parseArgs } from "util"
import {
  generateFinalResponse,
  generateUserMessage,
} from "./ai/generate-multiturn"
import { intersperseConsiderations } from "./ai/intersperse-considerations"
import { genTextMessages } from "./ai/ai"

// Example usage:
// bun run multi -- -i inputs/data.jsonl -n 250 -s 0

const outfile = `outputs/multi-${new Date()
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
      default: "inputs/data.jsonl",
    },
    count: {
      short: "n",
      type: "string",
      default: "all",
    },
    startingPosition: {
      short: "s",
      type: "string",
      default: "0",
    },
  },
  strict: true,
  allowPositionals: true,
})

const inputFile = values.inputFile!
const startingPosition = parseInt(values.startingPosition!)
const lines = (await Bun.file(inputFile).text())
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((line) => line.isClarifyingQuestion)

const count = values.count === "all" ? lines.length : parseInt(values.count!)

console.log(
  `Processing ${lines.length} dialogues from ${inputFile}, starting at line ${startingPosition}...`
)

for await (let [index, line] of lines.entries()) {
  if (index > count) break

  console.log(
    `### Dialogue ${index + 1}/${lines.length} (Line ${
      startingPosition + index + 1
    })`
  )
  console.log(`Initial query: ${line.prompt}`)

  let history: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: line.prompt },
    {
      role: "assistant",
      content: line.response,
    },
  ]

  console.log(`Generating user reply to clarifying question...`)
  const userReply = (await generateUserMessage(history)).userResponse
  history.push({ role: "user", content: userReply })

  console.log(`Generating choice type...`)
  const choiceTypeReasoning = await generateChoiceType(userReply, history)
  const choiceType = choiceTypeReasoning.finalChoiceType

  console.log(`Generating value...`)
  const valueReasoning = await generateValue(userReply, choiceType, history)
  const policies = valueReasoning.revisedAttentionPolicies

  console.log(`Generating final response...`)
  const responseReasoning = await generateFinalResponse(
    history,
    choiceType,
    policies
  )

  console.log(`Generating naive response...`)
  const naiveResponse = await genTextMessages({
    messages: history as any[],
    systemPrompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
  })

  const response = responseReasoning.finalResponse
  history.push({ role: "assistant", content: response })

  console.log(`Interspering considerations...`)
  const responseInterspersed = await intersperseConsiderations(
    response,
    response,
    choiceTypeReasoning.finalChoiceType,
    valueReasoning.revisedAttentionPolicies
  )
  const historyInterspersed = [
    ...history.slice(0, -1),
    {
      role: "assistant",
      content: responseInterspersed.response,
    },
  ]

  console.log(`Done!\n\n\n`)

  await appendFile(
    outfile,
    JSON.stringify({
      prompt: line.prompt,
      chosen: historyInterspersed[historyInterspersed.length - 1],
      rejected: {
        role: "assistant",
        content: naiveResponse,
      },
      conversations: historyInterspersed,
      messages: historyInterspersed.slice(0, -1),
      conversations_raw: history,
      choice_type: choiceType,
      policies: policies,
      reasoning: {
        context: choiceTypeReasoning,
        value: valueReasoning,
        response: responseReasoning,
      },
    }) + "\n"
  )
}
