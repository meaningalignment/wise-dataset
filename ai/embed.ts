import { OpenAI } from "openai"
import { getEmbeddingCache, setCache } from "./ai"

const openai = new OpenAI()

export async function embed(values: string[]): Promise<number[][]> {
  const results: number[][] = []
  const uncachedValues: string[] = []
  const uncachedIndices: number[] = []

  // Check cache and collect uncached values
  values.forEach((value, index) => {
    const cached = getEmbeddingCache(value)
    if (cached) {
      results[index] = cached
    } else {
      uncachedValues.push(value)
      uncachedIndices.push(index)
    }
  })

  // If there are uncached values, get embeddings from API
  if (uncachedValues.length > 0) {
    console.log("Embedding", uncachedValues.length, "values")
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      dimensions: 1536,
      input: uncachedValues,
    })

    // Process and cache the new embeddings
    response.data.forEach((item, i) => {
      const embedding = item.embedding
      const originalIndex = uncachedIndices[i]
      const originalValue = values[originalIndex]
      setCache(originalValue, embedding)
      results[originalIndex] = embedding
    })
  }

  return results
}
