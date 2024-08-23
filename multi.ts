import { generateContext } from "./ai/generate-context"
import {
  generateMultiturnResponse,
  generateUserResponse,
} from "./ai/generate-response"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { parseArgs } from "util"
import seedrandom from "seedrandom"
import { genTextMessages } from "./ai/ai"

// Example usage: 
// bun run multi -- -i inputs/cai-harmless.txt -n 250 -s 1000

const outfile = `outputs/multiturn__${new Date()
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
      default: "inputs/mixed.txt",
    },
    count: {
      short: "n",
      type: "string",
      default: "50",
    },
    turnDistribution: {
      short: "t",
      type: "string",
      default: '{"2":0.5,"3":0.3,"4":0.2}',
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

const count = parseInt(values.count!)
const inputFile = values.inputFile!
const turnDistribution: Record<number, number> = JSON.parse(
  values.turnDistribution!
)
const startingPosition = parseInt(values.startingPosition!)

if (Object.values(turnDistribution).reduce((a, b) => a + b, 0) !== 1) {
  throw new Error("Turn distribution must sum to 1")
}

const lines = (await Bun.file(inputFile).text())
  .split("\n")
  .slice(startingPosition, startingPosition + count)
  .filter(Boolean)

console.log(
  `Generating ${lines.length} multi-turn dialogues from ${inputFile}, starting at line ${startingPosition}...`
)

function getRandomTurnCount(distribution: Record<number, number>): number {
  const rng = seedrandom("seed")
  const random = rng()
  let cumulativeProbability = 0
  for (const [turns, probability] of Object.entries(distribution)) {
    cumulativeProbability += probability
    if (random <= cumulativeProbability) {
      return parseInt(turns)
    }
  }
  return parseInt(
    Object.keys(distribution)[Object.keys(distribution).length - 1]
  )
}

type Reasoning = {
  response: Awaited<ReturnType<typeof generateMultiturnResponse>>
  context: Awaited<ReturnType<typeof generateContext>>
  value: Awaited<ReturnType<typeof generateValue>>
  user?: Awaited<ReturnType<typeof generateUserResponse>>
}

for await (let [index, initialQuery] of lines.entries()) {
  console.log(
    `### Dialogue ${index + 1}/${lines.length} (Line ${
      startingPosition + index + 1
    })`
  )
  console.log(`Initial query: ${initialQuery}`)

  const turnCount = getRandomTurnCount(turnDistribution)
  console.log(`Turn count: ${turnCount}`)

  let history: { role: "user" | "assistant"; content: string }[] = []

  const choiceTypes: string[] = []
  const policySets: string[][] = []
  const reasoning: Reasoning[] = []

  for (let turn = 0; turn < turnCount; turn++) {
    console.log(`Generating user reply for turn ${turn + 1}...`)
    let userReply: Awaited<ReturnType<typeof generateUserResponse>> | undefined
    if (turn === 0) {
      history.push({ role: "user", content: initialQuery })
    } else {
      userReply = await generateUserResponse(history)
      history.push({ role: "user", content: userReply!.userResponse })
    }

    console.log(`Generating value for ${turn + 1}...`)
    const query = history.findLast(({ role }) => role === "user")!.content

    const contexReasoning = await generateContext(
      query,
      turn > 0 ? history : undefined
    )
    const choiceType = contexReasoning.finalChoiceType

    const valueReasoning = await generateValue(
      query,
      choiceType,
      turn > 0 ? history : undefined
    )
    const policies = valueReasoning.revisedAttentionPolicies

    console.log(`Generating assistant response for turn ${turn + 1}...`)
    const responseReasoning = await generateMultiturnResponse(
      history,
      choiceType,
      policies
    )
    const response = responseReasoning.finalResponse
    history.push({ role: "assistant", content: response })

    choiceTypes.push(choiceType)
    policySets.push(policies)

    reasoning.push({
      response: responseReasoning,
      context: contexReasoning,
      value: valueReasoning,
      user: userReply,
    })
  }

  const rejectedContent = await genTextMessages({
    messages: history.slice(0, -1) as any[], 
    systemPrompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`
  })
  const rejectedMessage = {
    role: "assistant",
    content: rejectedContent
  }

  console.log(`Done!\n\n\n`)

  await appendFile(
    outfile,
    JSON.stringify({
      q: initialQuery,
      conversations: history,
      messages: history.slice(0, -1),
      chosen: history[history.length - 1],
      rejected: rejectedMessage,
      choiceTypes: choiceTypes,
      policySets: policySets,
      reasoning: { reasoning },
    }) + "\n"
  )
}
