import { generateContext } from "./ai/generate-context"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { parseArgs } from "util"
import seedrandom from "seedrandom"
import { genTextMessages } from "./ai/ai"
import {
  generateContextResponse,
  generateFinalResponse,
  generateUserMessage,
} from "./ai/generate-multiturn"
import { intersperseConsiderations } from "./ai/intersperse-considerations"

// Example usage:
// bun run multi -- -i inputs/cai-harmless.txt -n 250 -s 1000

const outfile = `outputs/multiturn-${new Date()
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
      default: '{"2":0.7,"3":0.2,"4":0.1}',
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

if (
  Number(
    Object.values(turnDistribution)
      .reduce((a, b) => a + b, 0)
      .toFixed(5)
  ) !== 1
) {
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

type AssistantResponseReasoning =
  | Awaited<ReturnType<typeof generateFinalResponse>>
  | Awaited<ReturnType<typeof generateContextResponse>>

type Reasoning = {
  response: AssistantResponseReasoning
  context: Awaited<ReturnType<typeof generateContext>>
  value: Awaited<ReturnType<typeof generateValue>>
  user?: Awaited<ReturnType<typeof generateUserMessage>>
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
    let userReply: Awaited<ReturnType<typeof generateUserMessage>> | undefined
    if (turn === 0) {
      history.push({ role: "user", content: initialQuery })
    } else {
      userReply = await generateUserMessage(history)
      history.push({ role: "user", content: userReply!.userResponse })
    }

    console.log(`Generating value for ${turn + 1}...`)
    const query = history
      .filter(({ role }) => role === "user")
      .map(({ content }) => content)
      .join("\n\n")

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
    let responseReasoning: AssistantResponseReasoning | undefined
    if (turn === turnCount - 1) {
      responseReasoning = await generateFinalResponse(
        history,
        choiceType,
        policies
      )
    } else {
      responseReasoning = await generateContextResponse(
        history,
        choiceType,
        policies
      )
    }

    const response = responseReasoning!.finalResponse
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

  // Interspersing considerations into the history.
  let historyInterspersed: typeof history = []
  for (let i = 0; i < history.length; i++) {
    if (history[i].role === "user") {
      historyInterspersed.push(history[i])
    } else {
      const data = reasoning.findLast(
        ({ response }) => response.finalResponse === history[i].content
      )
      const interspersed = await intersperseConsiderations(
        history[i].content,
        data!.response.finalResponse,
        data!.context.finalChoiceType,
        data!.value.revisedAttentionPolicies
      )

      historyInterspersed.push({
        content: interspersed.response,
        role: history[i].role,
      })
    }
  }

  const rejectedContent = await genTextMessages({
    messages: history.slice(0, -1) as any[],
    systemPrompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
  })
  const rejectedMessage = {
    role: "assistant",
    content: rejectedContent,
  }

  console.log(`Done!\n\n\n`)

  await appendFile(
    outfile,
    JSON.stringify({
      prompt: initialQuery,
      chosen: historyInterspersed[historyInterspersed.length - 1],
      rejected: rejectedMessage,
      conversations: historyInterspersed,
      messages: historyInterspersed.slice(0, -1),
      conversations_raw: history,
      chosen_raw: history[history.length - 1],
      choiceTypes: choiceTypes,
      policySets: policySets,
      reasoning: { reasoning },
    }) + "\n"
  )
}
