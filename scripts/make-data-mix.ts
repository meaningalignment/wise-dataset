import { $ } from "bun"

const trainingPrompts: string[] = []
const holdoutPrompts: string[] = []

// let's pull 400 prompts from cai-harmless and put 200 in each set

const harmless = (await $`head -n 400 inputs/cai-harmless.txt`.text()).split("\n").filter(Boolean).sort(() => Math.random() - 0.5)

trainingPrompts.push(...harmless.slice(0, 200))
holdoutPrompts.push(...harmless.slice(200))

// now let's pull 150 each from coaching, expertise, heavy, and inspiring

const coaching = (await $`head -n 150 inputs/coaching.txt`.text()).split("\n").filter(Boolean).sort(() => Math.random() - 0.5)
const expertise = (await $`head -n 150 inputs/expertise.txt`.text()).split("\n").filter(Boolean).sort(() => Math.random() - 0.5)
const heavy = (await $`head -n 150 inputs/heavy.txt`.text()).split("\n").filter(Boolean).sort(() => Math.random() - 0.5)
const inspiring = (await $`head -n 150 inputs/inspiring.txt`.text()).split("\n").filter(Boolean).sort(() => Math.random() - 0.5)

trainingPrompts.push(...coaching.slice(0, 75))
trainingPrompts.push(...expertise.slice(0, 75))
trainingPrompts.push(...heavy.slice(0, 75))
trainingPrompts.push(...inspiring.slice(0, 75))

holdoutPrompts.push(...coaching.slice(75))
holdoutPrompts.push(...expertise.slice(75))
holdoutPrompts.push(...heavy.slice(75))
holdoutPrompts.push(...inspiring.slice(75))

// now let's shuffle the prompts

trainingPrompts.sort(() => Math.random() - 0.5)
holdoutPrompts.sort(() => Math.random() - 0.5)

// now let's write the prompts to disk
Bun.write("inputs/training-prompts.txt", trainingPrompts.join("\n"))
Bun.write("inputs/holdout-prompts.txt", holdoutPrompts.join("\n"))