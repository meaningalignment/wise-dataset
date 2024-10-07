import { z } from "zod"
import { genObj } from "../ai/ai"
import { writeFile } from "fs/promises"
import { formatHistory } from "../ai/generate-multiturn"

const inputFile = Bun.argv[2]
const outputFile = Bun.argv[3]

console.log(`Scanning for coachy responses in ${inputFile}...`)

const prompt = `You’ll receive a conversation and a set of attention policies. The conversation is between a user and a chatbot.

Imagine who the user is, based purely on their part in the conversation. Then, decide if the user would be likely to find the attention policies inspiring, interesting, relevant, and helpful.

Be especially careful if the attention policies sound like something a psychotherapist or life coach would write. The user would only find those inspiring or helpful if they have indicated an interest in such things, if the topic of conversation is closely related, or if they are exactly what is called for.

There are two exception to this:
(1) If the user is considering doing something bold, and the attentional policies will encourage them, mark the policies as relevant.
(2) If it's clear from what the user wrote, that they are extremely stressed out, and the attentional policies are calming, mark the policies as relevant.`

async function processFile() {
  const outputData = []

  for await (const line of (await Bun.file(inputFile).text())
    .split("\n")
    .filter(Boolean)) {
    const json = JSON.parse(line) as {
      prompt: string
      response: string
      conversations_raw: { role: string; content: string }[]
      isClarifyingQuestion: boolean
      policies: string[] | undefined
      attention_policies: string[] | undefined
    }
    if (!json.policies && !json.attention_policies) continue
    json.policies = json.policies || json.attention_policies

    const result = await genObj({
      prompt,
      schema: z.object({
        arePoliciesRelevant: z
          .boolean()
          .describe(
            `Would the user find these policies inspiring, interesting, relevant, and helpful?`
          ),
      }),
      data: {
        conversation: formatHistory(json.conversations_raw),
        policies: json.policies!.join("\n"),
      },
    })

    const outputEntry = {
      prompt: json.prompt,
      response: json.response,
      arePoliciesRelevant: result.arePoliciesRelevant,
    }
    outputData.push(outputEntry)

    // Log processing status and result
    console.log(`Processed entry: ${outputData.length}`)
    console.log(`Prompt: ${json.prompt}`)
    console.log(`Conversation: ${formatHistory(json.conversations_raw)}`)
    console.log(`Policies: ${json.policies!.join("\n")}`)
    console.log(`Are policies relevant: ${result.arePoliciesRelevant}`)
    console.log("---")
  }

  // Write output to JSONL file
  await writeFile(
    outputFile,
    outputData.map((d) => JSON.stringify(d)).join("\n")
  )
  console.log(`Output written to ${outputFile}`)
}

processFile().catch(console.error)
