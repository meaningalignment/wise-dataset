import { z } from "zod"
import { genObj } from "./ai"

export async function generateClarifyingQuestion(q: string) {
  return await genObj({
    prompt: `You will be provided with something a user might say to an AI chatbot. Your task is to think about how an AI chatbot might gather more information from the user in creative ways that fit the user's context and state.`,
    data: {
      "User's message": q,
    },
    schema: z.object({
      userCharacterization: z
        .string()
        .describe(
          `Characterize the user asking the initial question. What is his/her mood? What is his/her state of mind? What kind of response would they be receptive to?`
        ),
      typeOfResponseSuitable: z
        .string()
        .describe(
          `Based on what we guess the user wants, and what choice type and considerations we believe to be relevant, what type of response is most appropriate? Think about what level of formality or tone would be most suitable, what level of directness or indirectness, whether to be playful or serious, etc.`
        ),
      response: z
        .string()
        .describe(
          `Write a clear and concise imagined response from the AI mentioned above to the original message, based on your best ideas about what kind of response you believe is suitable. Avoid saying what you can't do. Also avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do). The purpose of the response should help the AI understand the user or situation better, so the AI's next response can help the user.`
        ),
      unreceptiveness: z
        .string()
        .describe(
          `Look at the response from the perspective of the user. Is there anything the user would feel unreceptive to? Have you accidentally been normative or prescriptive? Is there anything the user would not find inspiring or relevant, given their current situation, frame of mind, and what they like to fill their life with? Is there anywhere they'd feel lectured to or directed towards a goal which is not their own?`
        ),
      clichesAndBadExamples: z
        .string()
        .describe(
          `Look at the response from the perspective of the user. Are there tropes like "I hear you", "Sometimes, ..." or "Remember, ..."? How could they be replaced with better turns of phrase?`
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
