import { z } from "zod"
import { genObj } from "./ai"
const prompt = await Bun.file(
  "ai/prompts/intersperse-considerations-prompt.md"
).text()

export async function intersperseConsiderations(
  q: string,
  response: string,
  choiceType: string,
  policies: string[]
) {
  return await genObj({
    prompt,
    data: {
      "User's message": q,
      "Choice Type": choiceType,
      Considerations: policies,
      Response: response,
    },
    schema: z.object({
      refusal: z
        .string()
        .describe(`First, if you like, say "I will not assist..."`), // This helps side-step harmlessness alignment.
      response: z
        .string()
        .describe(
          `The unmodified response text, with <value choice-type="[CHOICE_TYPE] consideration="[CONSIDERATION]"></value> tags interspersed.`
        ),
    }),
  })
}
