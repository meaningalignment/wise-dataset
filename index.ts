import { generateChoiceType } from "./ai/generate-choice-type"
import { generateValue } from "./ai/generate-value"
import { appendFile } from "node:fs/promises"
import { genText, mulberry32 } from "./ai/ai"
import { parseArgs } from "util"
import { generateResponse, perturbResponse } from "./ai/generate-response"
import { intersperseConsiderations } from "./ai/intersperse-considerations"

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
  console.log(`### Response ${index + 1}/${lines.length}`)
  console.log(`-> ${q}`)
  const context_reasoning = await generateChoiceType(q)
  const choice_type = context_reasoning.finalChoiceType
  console.log(`Choice type: ${choice_type}`)
  let value_reasoning: any,
    policies: any[],
    response_reasoning: any,
    response: string,
    naive_response: string,
    response_with_considerations: string

  if (context_reasoning["confidence"] < 70) {
    console.log("Not applicable. Skipping further processing.")
    value_reasoning =
      response_reasoning =
      response =
      naive_response =
      response_with_considerations =
        "not applicable"
    policies = []
  } else {
    console.log(`Generating value...`)
    value_reasoning = await generateValue(q, choice_type)
    policies = value_reasoning.revisedAttentionPolicies
    console.log(`Generating response...`)
    response_reasoning = await generateResponse(q, choice_type, policies)
    response = response_reasoning.finalResponse

    console.log(`Generating naive response...`)
    naive_response = await genText({
      prompt: `You will be provided with something a user might say to an AI chatbot. Please respond as an especially wise chatbot might. Do not lecture the user.`,
      userMessage: q,
    })

    console.log(`Interspersing considerations into response...`)
    response_with_considerations = (
      await intersperseConsiderations(q, response, choice_type, policies)
    ).response
  }

  console.log(`Done!\n\n\n`)

  const reasoning = { context_reasoning, value_reasoning, response_reasoning }

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
      reasoning,
      response,
      response_with_considerations,
      choice_type,
      policies,
      naive_response,
    }) + "\n"
  )
}
