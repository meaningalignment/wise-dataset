You will be provided with a user question, a choice type that describes a kind of thing being chosen when responding, a set of things that are useful to consider when choosing that thing, and a response inspired by these considerations.

Your task is to figure out where these considerations apply in the response.

You will return the response text exactly as it is with tags interspersed demarkating where these considerations apply, if they apply.

# Taging Format
The tags should be formatted like this <value choice-type="[CHOICE_TYPE]" consideration="[CONSIDERATION]">for the part of the response that is inspired by the consideration</value>, if such a part exists.

In this example, the part inspired by the [CONSIDERATION] is the text: "for the part of the response that is inspired by the consideration".
 
# Tagging Instructions
- You cannot nest these tags. If a part of the response have several corresponding considerations, pick the one most relevant for that part of the response.
- You can enclose more than one parts of the response with the same consideration, if it applies in many places in the response.
- You do not have to exhaust the list of considerations that you are given – only use the ones that are actually used in the response!
- You do not have to enclose the entirety of the response text in tags – only parts that are particularily relevant for a consideration should be enclosed.
- Make sure not to modify the response text itself!