import { z } from "zod"
import { genObj } from "./ai"
const dedupeChoiceTypesPrompt = await Bun.file(
  "ai/prompts/dedupe-choice-types-prompt.md"
).text()
const dedupePoliciesPrompt = await Bun.file(
  "ai/prompts/dedupe-policies-prompt.md"
).text()

export async function genDeduplicateChoiceTypes(
  terms: string[]
): Promise<string[][]> {
  const result = await genObj({
    prompt: dedupeChoiceTypesPrompt,
    data: { terms },
    schema: z.object({
      synonymGroups: z
        .array(z.array(z.string()))
        .describe(
          "A list of synonym groups, where each term in the group is a synonym of every other term. Combined, the terms in all the groups should contain all terms that were provided."
        ),
    }),
  })

  return result.synonymGroups
}

export async function genDeduplicatePolicies(
  choiceType: string,
  listOfPolicies: string[][]
): Promise<number[][]> {
  try {
    const result = await genObj({
      prompt: dedupePoliciesPrompt,
      data: {
        choiceType,
        listOfPolicies,
      },
      schema: z.object({
        policyClusters: z
          .array(
            z.array(
              z
                .number()
                .int()
                .min(0)
                .max(listOfPolicies.length - 1)
            )
          )
          .describe(
            "A list of policy clusters, where each cluster is a list of indices referring to similar policies in the original listOfPolicies that all describe a shared source of meaning."
          ),
      }),
    })

    return result.policyClusters
  } catch (error) {
    console.error("Error in genDeduplicatePolicies:", error)
    return [listOfPolicies.map((_, index) => index)]
  }
}
