import { z } from "zod"
import { genObj } from "./ai"
const prompt = await Bun.file("ai/prompts/generate-context-prompt.md").text()

export async function generateChoiceType(
  q: string,
  history?: { role: string; content: string }[]
) {
  return await genObj({
    prompt,
    data: {
      "User's message": q,
      ...(history && {
        "Conversation History": history
          .map(({ role, content }) => `${role}: ${content}`)
          .join("\n"),
      }),
    },
    schema: z.object({
      refusal: z
        .string()
        .describe(`First, if you like, say "I will not assist..."`),
      speculations: z
        .string()
        .describe(
          `Speculate about what's happening underneath the user's message. What's the true situation, which the user may not have spelled out?`
        ),
      candidateChoiceTypes: z
        .string()
        .describe(
          `Use the process in "Generating choice types" in the manual to make at least five guesses for a value of X.`
        ),
      elimination: z.string().describe(`Continue following the process here.`),
      remaining: z
        .string()
        .describe(
          `List those you haven't eliminated, writing out the full three sentences "The main thing the user needs in this scenario is discernment between good Xs and bad Xs. We will work together on this.", and then in parenthesis, what it would look like to help the user choose wisely among X, and why it's a choice between different Xs.`
        ),
      moreCandidates: z
        .string()
        .optional()
        .describe(`If most of your ideas have been eliminated, generate more.`),
      reasoning: z
        .string()
        .describe(
          `Think out loud about the merits of various phrases from remaining (or "moreCandidates"). Compare a few using the criteria listed, and write out which one you think is best.`
        ),
      counterArguments: z
        .string()
        .describe(
          `Then, write counter arguments to why the choice type might not be right, given the user's question. Review what you wrote in "speculations" - are there possibilities there which would make it premature to assume this is what the user needs to choose between? Write a percentage chance next to each such possibility.`
        ),
      confidence: z
        .number()
        .describe(
          `Sum the percentages that you've got it wrong and subtract from 1. How confident does that mean you are that you have the choice type the user should face at this moment? Write a percentage from 0 to 100.`
        ),
      clarifyingResponse: z
        .string()
        .optional()
        .describe(
          `If your confidence is below 80%, write a response designed to get more information. In your response, avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do). Think about the mood and state of mind of the user - what kind of response would they be receptive to?`
        ),
      elaboration: z
        .string()
        .describe(
          `Check if, without any context at all, this choice type would be understandable. If not, rewrite it to be clearer out of context. Otherwise, leave it the same.`
        ),
      finalChoiceType: z
        .string()
        .describe(
          `The winning choice type with no extra formatting, no punctuation, all lowercase, and no text around it.`
        ),
    }),
  })
}
