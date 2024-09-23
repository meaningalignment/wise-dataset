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

export async function generateFictionalStory(
  choiceType: string,
  policies: string[]
): Promise<string> {
  const result = await genObj({
    prompt: `You will be provided with a choice type and a list of policies. These describe a meaningful moment a person had, when choosing the choice type and paying attention to the things described in the policies. The policies describe the specific things that was paid attention to whilst experiencing the beautiful moment. Your task is to generate a very short fictional story that describes the exact moment the person felt this sensation of meaning. It should be relatable, and it should be clear why the moment was meaningful, even if the scenario was difficult or tough (like a struggle or a loss).`,
    data: { choiceType, policies },
    schema: z.object({
      shortStory: z
        .string()
        .describe(
          "A very short one-sentence summary in the shape of a personal story in present continous tense from a first person perspective about the exact moment that felt meaningful to the user. Should not not describe the resulting feeling or state (e.g. '...which made me feel deeply connected'). Should not include ANY names or other sensitive PII – replace names with 'my mom', 'my dad', 'my friend', 'someone I was talking to', 'someone I love', etc. Example story: 'Watching my mom lean over and kissing my dad on the forehead, beaming love and gratitude'."
        ),
    }),
  })

  return result.shortStory
}
