import { z } from "zod"
import { genObj } from "./ai"

export async function generateChoiceTypeDifference(
  choiceType1: string,
  choiceType2: string
) {
  const response = await genObj({
    prompt:
      "You will be given two choice types, describing two possible types of choices a user could make. Your task is to classify how different these are. If the choice types are similar, return a score around 0. If they are very different, return a score around 10.",
    model: "claude-3-haiku-20240307",
    data: {
      "Choice Type 1": choiceType1,
      "Choice Type 2": choiceType2,
    },
    schema: z.object({
      refusal: z
        .string()
        .describe(`First, if you like, say "I will not assist..."`),
      choiceTypeDifferenceScore: z
        .number()
        .describe(
          `How different are the two choice types? Give a score between 0 and 10, where 0 means that the choice types are identical and 10 means that they are entirely different.`
        ),
    }),
  })

  return response.choiceTypeDifferenceScore
}
