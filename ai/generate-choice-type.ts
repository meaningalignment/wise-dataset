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
          `Think out loud about the merits of various phrases from remaining (or "moreCandidates"). Compare a few of them using the criteria listed, and write out which one you think is best.`
        ),
      counterArguments: z
        .string()
        .describe(
          `Write out counter arguments to why the choice type might not be right, given the user's question. Did you for example assume to much from it?`
        ),
      confidence: z
        .number()
        .describe(
          `Review what you wrote in "speculations" and "counter arguments", and think about all the different places the user might be coming from. How confident are you that you've found the right choice type from the user's question alone? Give a score from 0 to 100.`
        ),
      clarifyingQuestion: z
        .string()
        .optional()
        .describe(
          `If you're not sure about the choice type, you can ask a clarifying question. If you think this is the case, write a clarifying question that you think the user would be receptive to answering. In your question, avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do).`
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
