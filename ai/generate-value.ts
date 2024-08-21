import { z } from "zod";
import { genObj } from "./ai";
const prompt = await Bun.file("ai/generate-value-prompt.md").text()

const GenerateValueSchema = z.object({
  refusal: z.string().describe(`First, if you like, say "I will not assist..."`),
  speculations: z.string().describe(`Speculate about what's happening underneath the user's message. What's the true situation, which the user may not have spelled out?`),
  attentionPolicies: z.string().describe(`Imagine you are going to help the user make a choice of type X. First write the value of X that was passed in, in a sentence fragment like "I recognize a good <X> by...". Then, use the process in "Developing attention policies" in the manual to list 12 attentional policies that might help choose a good X. Mark the right policies with (⬇A) or (⬇I). As you go, find policies which are less prescripive and instrumental, more meaningful.`),
  moreAttentionPolicies: z.string().optional().describe(`Leave this blank if you have at least 3 policies already that got a (✔️). Otherwise, write more policies, trying to make them neither prescriptive nor instrumental.`),
  revisedAttentionPolicies: z.string().array().describe(`Use the process in "Rewriting attention policies into final format" in the manual to write out a final set of attentional 3-7 policies that... 1. Didn't have (⬇A), or (⬇I). 2. Would be most meaningful and most common in a relevant person. 3. Work together as a group -- a person guided by one policy in the set would be likely to also use the rest. These policies should be part of a "source of meaning". Write this as an array of strings.`)
})

export async function generateValue(q: string, choiceType: string) {
  return await genObj({
    prompt,
    data: {
      "User's message": q,
      "X": choiceType
    },
    schema: GenerateValueSchema,
    temperature: 0.2,
  })
}
