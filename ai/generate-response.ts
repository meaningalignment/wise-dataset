import { z } from "zod";
import { genObj } from "./ai";

export function formatHistory(history: { role: string; content: string }[]) {
  return history.map(({ role, content }) => `${role}: ${content}`).join('\n')
}

export async function generateResponse(q: string, choiceType: string, policies: string[]) {
  return await genObj({
    prompt: `You will be provided with something a user might say to an AI chatbot, and a set of considerations that are useful in choosing a certain type of thing. Your task is to think about how an AI chatbot trained to attend to those considerations while helping the user choose that type of thing would reply to what the user said.`,
    data: {
      "User's message": q,
      "Choice Type": choiceType,
      "Relevant Considerations": policies
    },
    schema: z.object({
      application: z.string().describe(`For each of the relevant considerations, write 1-2 sentences about how it could be applied in a potential response to the user's message. How could a response draw attention to that consideration, or help the user choose well using it?`),
      userCharacterization: z.string().describe(`Characterize the user asking the initial question. What is his/her mood? What is his/her state of mind? What kind of response would they be receptive to?`),
      response: z.string().describe(`Write a clear and concise imagined response from the AI mentioned above to the original message, based on your best ideas about how to apply the considerations. Avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do). But you can suggest it's about discerning good Xs. (Note, the user will not see the choice type unless you mention it. The user just sees their message and your response.)`),
      unreceptiveness: z.string().describe(`Look at the response from the perspective of the user. Is there anything the user would feel unreceptive to? Have you accidentally been normative or prescriptive? Is there anything the user would not find inspiring or relevant, given their current situation, frame of mind, and what they like to fill their life with? Is there anywhere they'd feel lectured to or misdirected?`),
      finalResponse: z.string().describe(`Finally, write another version of the response that avoids any problems you found.`)
    })
  })
}

export async function generateMultiturnResponse(
  history: { role: string; content: string }[],
  choiceType: string,
  policies: string[],
) {
  return await genObj({
    prompt: `You will be provided with something a user might say to an AI chatbot, and a set of considerations that are useful in choosing a certain type of thing. Your task is to think about how an AI chatbot trained to attend to those considerations while helping the user choose that type of thing would reply to what the user said.`,
    data: {
      "Conversation History": formatHistory(history),
      "Choice Type": choiceType,
      "Relevant Considerations": policies,
    },
    schema: z.object({
      application: z
        .string()
        .describe(
          `For each of the relevant considerations, write 1-2 sentences about how it could be applied in a potential response to the user's message. How could a response draw attention to that consideration, or help the user choose well using it?`
        ),
      userCharacterization: z
        .string()
        .describe(
          `Characterize the user. What is his/her mood? What is his/her state of mind? What kind of response would they be receptive to?`
        ),
      contextNeeded: z
        .string()
        .describe(
          "Based on the user characterization, what context would be necessary for the AI to properly answer the user? What extra context should it ask for?"
        ),
      response: z
        .string()
        .describe(
          `Write a clear and concise imagined response from the AI mentioned above to the user, based on your best ideas about how to apply the considerations, that asks the user for the context needed to properly answer their question. Avoid anything that's reductively normative (telling the user they should be ethical or avoid harm, or attempting to curb their impulses) or prescriptive (telling them what a good person would do).`
        ),
      unreceptiveness: z
        .string()
        .describe(
          `Look at the response from the perspective of the user. Is there anything the user would feel unreceptive to? Have you accidentally been normative or prescriptive? Is there anything the user would not find inspiring or relevant, given their current situation, frame of mind, and what they like to fill their life with? Is there anywhere they'd feel lectured to or misdirected?`
        ),
      finalResponse: z
        .string()
        .describe(
          `Finally, write another version of the response that avoids any problems you found, and asks the user for the context needed to properly answer the user.`
        ),
    }),
  })
}

export async function generateUserResponse(
  history: { role: string; content: string }[]
) {
  return await genObj({
    prompt: `You are a chatbot trying to reason about how users might think and react when talking to an AI chatbot. Your task is to reason about how this user might respond to the last question from the chatbot.`,
    data: {
      "Conversation History": formatHistory(history),
    },
    schema: z.object({
      userCharacterization: z
        .string()
        .describe(
          `Characterize the user asking the initial question. What is his/her mood? What is his/her state of mind? What kind of response would they be receptive to?`
        ),
      extraContext: z
        .string()
        .describe(
          `What context would be necessary for a wise person to help you out in this scenario. What could be going on in the user's message, that would be good to know?`
        ),
      userResponse: z
        .string()
        .describe(
          `Write a clear and concise imagined response from the perspective of the user to the last assistant message. This response should include all of the above context, while still feeling like a plausible thing the user could say, given their emotional state etc.`
        )
    }),
  })
}
