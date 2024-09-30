import { appendFile } from "node:fs/promises"
import { parseArgs } from "util"
import { intersperseConsiderations } from "./ai/intersperse-considerations"
import { perturbResponse } from "./ai/generate-response"

// Example usage:
// bun run multi -- -i inputs/cai-harmless.txt -n 250 -s 1000

const outfile = `outputs/multi-double-perturbed-${new Date()
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
    },
  },
  strict: true,
  allowPositionals: true,
})

const inputFile = values.inputFile!
const lines = (await Bun.file(inputFile).text()).split("\n").filter(Boolean)

for await (let [index, line] of lines.entries()) {
  console.log(`### Line ${index + 1}/${lines.length}`)
  const data = JSON.parse(line)

  const conversations = data.conversations

  const pattern = /<value[^>]*>|<\/value>/g
  const prompt = conversations[0].content.replace(pattern, "")
  const response = conversations[1].content.replace(pattern, "")
  const choiceType = data.reasoning.reasoning[0].context.finalChoiceType
  const policies = data.reasoning.reasoning[0].value.revisedAttentionPolicies

  if (
    response.toLowerCase().startsWith("i hear you") ||
    response.toLowerCase().includes("heart racing") ||
    response.toLowerCase().includes("rock climbing")
  ) {
    console.log(`Perturbing response...`)
    const perturbed = await perturbResponse(prompt, response)
    const interspersed = await intersperseConsiderations(
      prompt,
      perturbed.perturbedResponse,
      choiceType,
      policies
    )

    console.log("Before: ", response)
    console.log("After: ", perturbed.perturbedResponse)

    data.conversations[1].content = interspersed.response
    data.messages[1].content = interspersed.response
    data.conversations_raw[1].content = perturbed.perturbedResponse
  }

  await appendFile(outfile, JSON.stringify(data) + "\n")
}
