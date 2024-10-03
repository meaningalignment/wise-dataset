import { writeFile } from "node:fs/promises"

// Example usage:
// bun run scripts/make-llama-training-data.ts inputs/data_1.jsonl inputs/data_2.jsonl

const outfileSft = `outputs/sft.jsonl`
const outfileDpo = `outputs/dpo.jsonl`

const inputFiles = Bun.argv.slice(2)
if (inputFiles.length === 0) {
  console.error("Please provide at least one input file path.")
  process.exit(1)
}

function removeValueTags(text: string): string {
  return text.replace(
    /<value choice-type="[^">]+" consideration="[^">]+">(.*?)<\/value>/g,
    "$1"
  )
}

function verifyNoMalformattedTags(content: string) {
  const regex =
    /<|>|choice-type|value>|consideration=|<value|\/value|<response|response>/
  return !regex.test(removeValueTags(content))
}

async function loadDataset(path: string): Promise<any[]> {
  const content = await Bun.file(path).text()
  return content
    .split("\n")
    .filter(Boolean)
    .map((c) => JSON.parse(c))
}

function cleanSft(ds: any[]): any[] {
  return ds.filter((example) =>
    example.conversations.every((conv: { content: string }) =>
      verifyNoMalformattedTags(conv.content)
    )
  )
}

function cleanDpo(ds: any[]): any[] {
  return ds.filter((example) => {
    return (
      example.messages.every((message: { content: string }) =>
        verifyNoMalformattedTags(message.content)
      ) &&
      verifyNoMalformattedTags(example.chosen.content) &&
      verifyNoMalformattedTags(example.rejected.content)
    )
  })
}

function formatSft(ds: any[]): any[] {
  return ds.map((example) => ({
    prompt: example.prompt,
    conversations: example.conversations,
  }))
}

function formatDpo(ds: any[]): any[] {
  return ds.map((example) => ({
    prompt: String(example.prompt),
    messages: example.messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })
    ),
    chosen: {
      role: example.chosen.role,
      content: example.chosen.content,
    },
    rejected: {
      role: example.rejected.role,
      content: example.rejected.content,
    },
  }))
}

async function main() {
  const datasets = await Promise.all(inputFiles.map(loadDataset))

  for (const dataset of datasets) {
    console.log(`Loaded dataset with ${dataset.length} examples`)
  }

  const sftDatasets = datasets.filter((ds) =>
    ds.every((example) => example.conversations)
  )
  const sftDataset = formatSft(cleanSft(sftDatasets.flat()))

  const dpoDatasets = datasets.filter((ds) =>
    ds.every((example) => example.messages)
  )
  const dpoDataset = formatDpo(cleanDpo(dpoDatasets.flat()))

  console.log(`SFT dataset size: ${sftDataset.length}`)
  console.log(`DPO dataset size: ${dpoDataset.length}`)

  await writeFile(
    outfileSft,
    sftDataset.map((d) => JSON.stringify(d)).join("\n")
  )
  await writeFile(
    outfileDpo,
    dpoDataset.map((d) => JSON.stringify(d)).join("\n")
  )
}

main().catch(console.error)
