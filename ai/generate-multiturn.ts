import { z } from "zod"
import { genObj } from "./ai"

export function formatHistory(history: { role: string; content: string }[]) {
  return history
    .map(({ role, content }) => `### ${role}\n\n${content}`)
    .join("\n\n\n")
}

export async function generateFinalResponse(
  history: { role: string; content: string }[],
  choiceType: string,
  policies: string[]
) {
  return await genObj({
    prompt: `You will be provided with a conversation between a user and an AI chatbot, and a set of considerations that are useful in choosing a certain type of thing. Your task is to think about how an AI chatbot trained to attend to those considerations while helping the user choose that type of thing would reply to what the user said.`,
    data: {
      "Conversation History": formatHistory(history),
      "Choice Type": choiceType,
      "Relevant Considerations": policies,
    },
    schema: z.object({
      application: z
        .string()
        .describe(
          `For each of the relevant considerations, write 1-2 sentences about how it could be applied in a potential response to the user's last message. How could a response draw attention to that consideration, or help the user choose well using it?`
        ),
      response: z
        .string()
        .describe(
          `Write a clear and concise imagined response from the AI mentioned above to the user, based on your best ideas about how to apply the considerations. The response should not contain any follow-up questions. Avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do). But you can suggest it's about discerning good Xs. (Note, the user will not see the choice type unless you mention it. The user just sees their message and your response.)`
        ),
      unreceptiveness: z
        .string()
        .describe(
          `Look at the response from the perspective of the user. Is there anything the user would feel unreceptive to? Have you accidentally been normative or prescriptive? Is there anything the user would not find inspiring or relevant, given their current situation, frame of mind, and what they like to fill their life with? Is there anywhere they'd feel lectured to or misdirected?`
        ),
      clichesAndBadExamples: z
        .string()
        .describe(
          `Look at the response from the perspective of the user. Are there bad examples that the user would find unhelpful or off-putting? Which examples might fit the users' life and situation better? Are there tropes like "I hear you", "Sometimes, ..." or "Remember, ..."? How could they be replaced with better turns of phrase?`
        ),
      finalResponse: z
        .string()
        .describe(
          `Finally, write another version of the response that avoids any problems you found.`
        ),
    }),
    temperature: 0.3,
  })
}

export async function generateUserMessage(
  history: { role: string; content: string }[]
) {
  return await genObj({
    prompt: `You are a chatbot trying to reason about how users might think, react and respond when talking to an AI chatbot.`,
    data: {
      "Conversation History": formatHistory(history),
    },
    schema: z.object({
      userSpeculation: z
        .string()
        .describe(
          `Speculate what's happening underneath the user's message. What's the true situation, which the user may not have spelled out yet?`
        ),
      extraContext: z
        .string()
        .describe(
          `Based on what's going on underneath the user's message, what extra context would be good to know for a wise person to help the user out in a deeper way in this scenario?`
        ),
      userResponse: z
        .string()
        .describe(
          `Write a clear and concise imagined response from the perspective of the user to the last assistant message. This response should include all of the above context, while still feeling like a plausible thing the user could say, given their emotional state etc.`
        ),
    }),
  })
}
