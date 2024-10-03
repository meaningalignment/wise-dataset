import { parseArgs } from "util"
import { appendFile, readFile } from "node:fs/promises"
import seedrandom from "seedrandom"

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: {
      short: "i",
      type: "string",
      default: "outputs/training-data-1500.jsonl",
    },
    outputFile: {
      short: "o",
      type: "string",
    },
    count: {
      short: "n",
      type: "string",
      default: "all",
    },
    startPosition: {
      short: "s",
      type: "string",
      default: "0",
    },
    mixAttribute: {
      short: "m",
      type: "string",
      default: "both",
    },
  },
  strict: true,
  allowPositionals: true,
})

// Generate the output file name after parsing arguments
let inputName = values.inputFile!.split("/").pop()!.replace(".jsonl", "")
if (values.count !== "all") {
  inputName = inputName.replace(/\d+/, values.count!)
}

const mixAttribute = values.mixAttribute!
const outputFile =
  values.outputFile || `outputs/${inputName}-shuffled-${mixAttribute}.jsonl`
const inputFile = values.inputFile!
const numLines = values.count === "all" ? "all" : parseInt(values.count!, 10)

const rng = seedrandom("seed")

async function loadDataset(filename: string) {
  const content = await readFile(filename, "utf-8")
  const dataset = content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((line) => !line.isClarifyingQuestion)

  console.log(dataset.length)
  return dataset
}

function getRandomSamples(dataset: any[], exclude: number, count: number = 5) {
  const lines: any[] = []
  while (lines.length < count) {
    const index = Math.floor(rng() * dataset.length)
    if (index !== exclude && !lines.includes(dataset[index])) {
      lines.push(dataset[index])
    }
  }
  return lines
}

function extractValueAttributes(text: string) {
  const regex = /<value[^>]*>/g
  const matches = text.match(regex) || []
  return matches.map((match) => {
    const choiceType = match.match(/choice-type="([^"]*)"/) || []
    const consideration = match.match(/consideration="([^"]*)"/) || []
    return { choiceType: choiceType[1], consideration: consideration[1] }
  })
}

function replaceValueAttributes(
  text: string,
  attributes: any[],
  mixAttribute: string
) {
  let result = text
  let index = 0
  return result.replace(/<value[^>]*>/g, (match) => {
    const attr = attributes[index % attributes.length]
    index++
    const originalAttr = extractValueAttributes(match)[0]

    let choiceType, consideration

    switch (mixAttribute) {
      case "choice-type":
        choiceType = attr.choiceType
        consideration = originalAttr.consideration
        break
      case "consideration":
        choiceType = originalAttr.choiceType
        consideration = attr.consideration
        break
      case "both":
        choiceType = attr.choiceType
        consideration = attr.consideration
        break
      default:
        throw new Error(`Invalid mix attribute: ${mixAttribute}`)
    }

    return `<value choice-type="${choiceType}" consideration="${consideration}">`
  })
}

async function processDataset() {
  const dataset = await loadDataset(inputFile)
  const startPosition = parseInt(values.startPosition!)
  const linesToProcess =
    numLines === "all"
      ? dataset.length
      : Math.min(numLines + startPosition, dataset.length)

  for (let i = startPosition; i < linesToProcess; i++) {
    const randomSamples = getRandomSamples(dataset, i)
    const randomValueAttributes = randomSamples.flatMap((line) =>
      extractValueAttributes(line.chosen.content)
    )

    const chosenContent = dataset[i].chosen.content
    const modifiedContent = replaceValueAttributes(
      chosenContent,
      randomValueAttributes,
      mixAttribute
    )

    dataset[i].rejected.content = modifiedContent
    dataset[i].conversations = null // Remove this field, only used for SFT.

    await appendFile(outputFile, JSON.stringify(dataset[i]) + "\n")
  }

  console.log(
    `Processed ${
      linesToProcess - startPosition
    } lines starting from position ${startPosition}. Dataset saved to ${outputFile}`
  )
}

processDataset().catch(console.error)
