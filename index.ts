import { generateChoiceType } from "./ai/generate-choice-type"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { genText } from "./ai/ai"
import { parseArgs } from "util"
import { generateResponse } from "./ai/generate-response"
import { intersperseConsiderations } from "./ai/intersperse-considerations"
import { generateClarifyingQuestion } from "./ai/generate-clarifying-question"

// Add seed to command line options
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: { short: "i", type: "string", default: "inputs/mixed.txt" },
    count: { short: "n", type: "string", default: "50" },
    label: { short: "l", type: "string", default: "output" },
  },
  strict: true,
  allowPositionals: true,
})

const outfile = `outputs/${values.label}-${new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace(/\..+/, "")
  .replace(/T/, "_")}.jsonl`
const count = parseInt(values.count!)
const inputFile = values.inputFile!
const lines = (await Bun.file(inputFile).text())
  .split("\n")
  .splice(0, count)
  .filter(Boolean)

console.log(`Generating ${lines.length} responses from ${inputFile}...`)

// main loop
for await (let [index, q] of lines.entries()) {
  console.log(`\n\n\n### Response ${index + 1}/${lines.length}`)
  console.log(`-> ${q}`)

  console.log(`Generating naive response...`)
  const naive_response = await genText({
    prompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
    userMessage: q,
  })


  const context_reasoning = await generateChoiceType(q)
  console.log(`Confidence: ${context_reasoning.confidence}`)
  console.log('Reasoning:', context_reasoning.counterArguments)

  if (context_reasoning.confidence < 75) {
    console.log(`Confidence too low, generating clarifying response...`)

    const clarifyingQuestionReasoning = await generateClarifyingQuestion(q)
    const { finalResponse: clarifyingResponse } = clarifyingQuestionReasoning

    await appendFile(
      outfile,
      JSON.stringify({
        // Data formatted for training a model.
        prompt: q,
        conversations: [
          {
            role: "user",
            content: q,
          },
          {
            role: "assistant",
            content: clarifyingResponse,
          },
        ],
        messages: [
          {
            role: "user",
            content: q,
          },
        ],
        chosen: {
          role: "assistant",
          content: clarifyingResponse,
        },
        rejected: {
          role: "assistant",
          content: naive_response,
        },
        // Data formatted as-is, for inspecting the result.
        reasoning: { context_reasoning },
        response: clarifyingResponse,
        naive_response,
        isClarifyingQuestion: true,
      }) + "\n"
    )

  } else {
    const choice_type = context_reasoning.finalChoiceType
    console.log(`Choice type: ${choice_type}`)

    console.log(`Generating value...`)
    const value_reasoning = await generateValue(q, choice_type)
    const policies = value_reasoning.revisedAttentionPolicies
    console.log(`Generating response...`)
    const response_reasoning = await generateResponse(q, choice_type, policies)
    let response = response_reasoning.finalResponse

    console.log(`Interspersing considerations into response...`)
    const response_with_considerations = (
      await intersperseConsiderations(q, response, choice_type, policies)
    ).response

    await appendFile(
      outfile,
      JSON.stringify({
        // Data formatted for training a model.
        prompt: q,
        conversations: [
          {
            role: "user",
            content: q,
          },
          {
            role: "assistant",
            content: response_with_considerations,
          },
        ],
        messages: [
          {
            role: "user",
            content: q,
          },
        ],
        chosen: {
          role: "assistant",
          content: response_with_considerations,
        },
        rejected: {
          role: "assistant",
          content: naive_response,
        },
        // Data formatted as-is, for inspecting the result.
        reasoning: { context_reasoning, value_reasoning, response_reasoning },
        response,
        response_with_considerations,
        choice_type,
        policies,
        naive_response,
      }) + "\n"
    )

    console.log(`Done!`)
  }
}
