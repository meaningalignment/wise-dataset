import { z } from "zod"
import { genObj } from "../ai/ai"

const inputFile = Bun.argv[2]
console.log(`Scanning for coachy responses in ${inputFile}...`)

const prompt = `You’ll receive a conversation and a set of attention policies. The conversation is between a user and a chatbot.

Imagine who the user is, based purely on their part in the conversation. Then, decide if the user would be likely to find the attention policies inspiring, interesting, relevant, and helpful.

Be especially careful if the attention policies sound like something a psychotherapist or life coach would write. The user would only find those inspiring or helpful if they have indicated an interest in such things, if the topic of conversation is closely related, or if they are exactly what is called for.

There are two exception to this:
(1) If the user is considering doing something bold, and the attentional policies will encourage them, mark the policies as relevant.
(2) If it's clear from what the user wrote, that they are extremely stressed out, and the attentional policies are calming, mark the policies as relevant.
`

for await (const line of (await Bun.file(inputFile).text())
  .split("\n")
  .filter(Boolean)) {
  const json = JSON.parse(line) as {
    prompt: string
    response: string
    isClarifyingQuestion: boolean
    policies: string[] | undefined
  }
  if (!json.policies) continue

  const result = await genObj({
    prompt,
    schema: z.object({
      arePoliciesRelevant: z.boolean().describe(`Would the user find these policies inspiring, interesting, relevant, and helpful?`),
    }),
    data: {
      conversation: `USER: ${json.prompt}\n\nCHATBOT: ${json.response}`,
      policies: json.policies.join("\n"),
    },
  })

  if (!result.arePoliciesRelevant) {
    console.log(`\n\n\n### Coachy response detected`)
    console.log(`-> ${json.prompt}`)
    console.log(`-> ${json.response}`)
    console.log(`-> ${json.policies.join("\n")}`)
  } else {
    console.log(`\n\n\n### Non-coachy response`)
    console.log(`-> ${json.prompt}`)
    console.log(`-> ${json.response}`)
  }
}
