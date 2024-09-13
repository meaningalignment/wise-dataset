import fs from "fs"
import readline from "readline"
import { z } from "zod"
import {
  genDeduplicateChoiceTypes,
  genDeduplicatePolicies,
} from "./ai/generate-deduplication"
import { parseArgs } from "util"
import { DBSCAN } from "density-clustering"
import { embed } from "./ai/ai"

function cosineDistance(vecA: number[], vecB: number[]) {
  let dotProduct = 0.0
  let normA = 0.0
  let normB = 0.0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return 1.0 - dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    inputFile: {
      short: "i",
      type: "string",
      default: "input.jsonl",
    },
    n: {
      short: "n",
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
})

// Define the schema for the input data.
const InputSchema = z.object({
  choice_type: z.string(),
  policies: z.array(z.string()),
})

type InputData = z.infer<typeof InputSchema>

// Define the schema for the output data.
const OutputSchema = z.object({
  deduplicated_choice_type: z.string(),
  choice_types: z.array(z.string()),
  deduplicated_value: z.array(z.string()),
  values: z.array(z.array(z.string())),
})

type OutputData = z.infer<typeof OutputSchema>

async function readJsonlFile(filePath: string): Promise<InputData[]> {
  const fileStream = fs.createReadStream(filePath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  const data: InputData[] = []

  for await (const line of rl) {
    try {
      const parsedLine = JSON.parse(line)
      const validatedLine = InputSchema.parse(parsedLine)
      data.push(validatedLine)
    } catch (error) {
      console.error("Error parsing line:", error)
    }
  }

  return data
}

async function getDeduplicatedChoiceTypes(
  choiceTypes: string[]
): Promise<Map<string, string[]>> {
  // 1. Get unique choice types
  const uniqueChoiceTypes = Array.from(new Set(choiceTypes))

  // 2. Get embeddings
  const embeddings = await embed(uniqueChoiceTypes)

  // 3. Cluster with DBSCAN
  const dbscan = new DBSCAN()
  const dbscanClusters = dbscan
    .run(embeddings, 0.3, 5, cosineDistance)
    .map((cluster) => cluster.map((i) => uniqueChoiceTypes[i]))

  const clusteredValues = new Set(dbscanClusters.flat())
  const unclusteredValues = uniqueChoiceTypes.filter(
    (value) => !clusteredValues.has(value)
  )

  if (unclusteredValues.length > 0) {
    dbscanClusters.push(unclusteredValues)
  }

  console.log("DBSCAN clustering results:", dbscanClusters)

  // 4. & 5. Process each DBSCAN cluster and deduplicate
  const dedupedChoiceTypes = new Map<string, string[]>()
  for (const cluster of dbscanClusters) {
    const deduplicatedCluster = await genDeduplicateChoiceTypes(cluster)
    for (const group of deduplicatedCluster) {
      const representative = group[group.length - 1]
      dedupedChoiceTypes.set(representative, group)
    }
  }

  // 6. Ensure all contexts exist in the final list
  for (const context of uniqueChoiceTypes) {
    if (!Array.from(dedupedChoiceTypes.values()).flat().includes(context)) {
      dedupedChoiceTypes.set(context, [context])
    }
  }

  return dedupedChoiceTypes
}

async function deduplicateValues(
  inputFile: string,
  outputFile: string,
  n: number | null
): Promise<void> {
  const rawData = await readJsonlFile(inputFile)
  const data = n !== null ? rawData.slice(0, n) : rawData

  // Deduplicate contexts
  const contexts = data.map((item) => item.choice_type)
  const deduplicatedChoiceTypes = await getDeduplicatedChoiceTypes(contexts)

  console.log("Deduplicated choice types length before:", contexts.length)
  console.log(
    "Deduplicated choice types length after:",
    deduplicatedChoiceTypes.size
  )

  // Deduplicate policies
  const deduplicatedPolicies: string[][][] = []
  for (const [index, [representative, synonyms]] of Array.from(
    deduplicatedChoiceTypes.entries()
  ).entries()) {
    console.log(
      `Deduplicating cluster ${index}/${deduplicatedChoiceTypes.size}: ${representative}`
    )
    const relevantItems = data.filter((item) =>
      synonyms.includes(item.choice_type)
    )
    const policiesForChoiceType = relevantItems.map((item) => item.policies)

    if (relevantItems.length === 1) {
      // If there's only one relevant item, push it directly
      deduplicatedPolicies.push([policiesForChoiceType[0]])
      console.log("Single value for choice type, not running prompt!")
    } else {
      // If there are multiple items, proceed with deduplication
      const policyClusterIndices = await genDeduplicatePolicies(
        representative,
        policiesForChoiceType
      )

      // Ensure all original policies are included
      const includedIndices = new Set(policyClusterIndices.flat())
      for (let i = 0; i < policyClusterIndices.length; i++) {
        if (!includedIndices.has(i)) {
          policyClusterIndices.push([i])
        }
      }

      // Convert indices to original policy lists
      const clusteredPolicies = policyClusterIndices.map((cluster) =>
        cluster.map((index) => policiesForChoiceType[index])
      )

      console.log(
        `Value clusters for choice type ${representative}:`,
        clusteredPolicies
      )
      deduplicatedPolicies.push(...clusteredPolicies!)
    }
  }

  console.log("Deduplicated values length before:", data.length)
  console.log("Deduplicated values length after:", deduplicatedPolicies.length)

  // Create output data
  const outputData: OutputData[] = []
  deduplicatedChoiceTypes.forEach((synonyms, deduplicatedChoiceType) => {
    const relevantItems = data.filter((item) =>
      synonyms.includes(item.choice_type)
    )
    const deduplicatedPoliciesForChoiceType = deduplicatedPolicies.filter(
      (cluster) =>
        cluster.some((policies) =>
          relevantItems.some(
            (item) =>
              item.policies.length === policies.length &&
              item.policies.every((policy, index) => policy === policies[index])
          )
        )
    )
    deduplicatedPoliciesForChoiceType.forEach((policyCluster) => {
      const values = relevantItems
        .filter((item) =>
          policyCluster.some(
            (policies) =>
              item.policies.length === policies.length &&
              item.policies.every((policy, index) => policy === policies[index])
          )
        )
        .map((item) => item.policies)
      outputData.push({
        deduplicated_value: policyCluster[0], // Use the first policy in the cluster as the deduplicated value
        deduplicated_choice_type: deduplicatedChoiceType,
        choice_types: synonyms,
        values: values,
      })
    })
  })

  // Write the results to the specified output file
  const outputStream = fs.createWriteStream(outputFile)
  outputData.forEach((item) => {
    outputStream.write(JSON.stringify(item) + "\n")
  })
  outputStream.end()

  console.log(`Deduplication results written to ${outputFile}`)
}

// Run the deduplication with output file name
const outputFileName = `outputs/deduplication-${new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace(/\..+/, "")}.jsonl`
deduplicateValues(
  values.inputFile!,
  outputFileName,
  values.n ? parseInt(values.n) : null
).catch(console.error)
