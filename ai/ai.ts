import { generateObject, generateText, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z, ZodSchema } from "zod"
import { Database } from "bun:sqlite"
import { zodToJsonSchema } from "zod-to-json-schema"
import OpenAI from "openai"

const db = new Database("cache.sqlite", { create: true })
const hasher = new Bun.CryptoHasher("md5")
const openai = new OpenAI()

db.query(
  "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT)"
).run()

export function setCache(key: string, value: any) {
  db.query(
    "INSERT OR REPLACE INTO cache (key, value) VALUES ($key, $value)"
  ).run({
    $key: key,
    $value: JSON.stringify(value),
  })
}

export function getCache(key: string) {
  const row = db
    .query("SELECT * FROM cache WHERE key = $key")
    .get({ $key: key }) as { key: string; value: string } | undefined
  return row ? JSON.parse(row.value) : undefined
}

function cacheKeyForPromptDataAndSchema({
  prompt,
  data,
  schema,
  model,
  temperature,
}: {
  prompt: string
  data: string
  schema: ZodSchema
  model: string
  temperature: number
}) {
  const jsonSchema = zodToJsonSchema(schema)
  hasher.update(
    JSON.stringify({ prompt, data, schema: jsonSchema, model, temperature })
  )
  return hasher.digest("hex")
}

function stringifyObj(obj: any) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined
      }
      return value
    },
    2
  )
}

function stringifyArray(arr: any[]) {
  return arr.map(stringifyObj).join("\n\n")
}

function stringify(value: any) {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  } else if (typeof value === "string") {
    return value
  } else {
    return stringifyObj(value)
  }
}

export async function genObj<T extends ZodSchema>({
  prompt,
  data,
  schema,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  prompt: string
  data: Record<string, any>
  schema: T
  temperature?: number
  model?: string
}): Promise<z.infer<T>> {
  const renderedData = Object.entries(data)
    .map(([key, value]) => `# ${key}\n\n${stringify(value)}`)
    .join("\n\n")
  const cacheKey = cacheKeyForPromptDataAndSchema({
    prompt,
    data: renderedData,
    schema,
    model,
    temperature,
  })
  const cached = getCache(cacheKey)
  if (cached) {
    console.log("Cache hit!")
    return cached
  }
  const { object } = await generateObject({
    model: anthropic(model),
    schema,
    system: prompt,
    messages: [{ role: "user", content: renderedData }],
    temperature,
    mode: "auto",
  })
  setCache(cacheKey, object)
  return object
}

export async function genText({
  prompt,
  userMessage,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  prompt: string
  userMessage: string
  model?: string
  temperature?: number
}): Promise<string> {
  const cacheKey = hasher
    .update(JSON.stringify({ prompt, userMessage, model, temperature }))
    .digest("hex")
  const cached = getCache(cacheKey)
  if (cached) {
    console.log("Cache hit!")
    return cached
  }
  const { text } = await generateText({
    model: anthropic(model),
    system: prompt,
    messages: [{ role: "user", content: userMessage }],
    temperature,
  })
  setCache(cacheKey, text)
  return text
}

export async function genTextMessages({
  messages,
  systemPrompt,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
}: {
  messages: CoreMessage[]
  systemPrompt?: string
  model?: string
  temperature?: number
}): Promise<string> {
  const cacheKey = hasher
    .update(
      JSON.stringify({
        messages: messages.map((m) => m.content).join(),
        model,
        temperature,
      })
    )
    .digest("hex")
  const cached = getCache(cacheKey)
  if (cached) {
    console.log("Cache hit!")
    return cached
  }
  const { text } = await generateText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    temperature,
  })
  setCache(cacheKey, text)
  return text
}

export async function embed(values: string[]): Promise<number[][]> {
  console.log("Embedding", values.length, "values")
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    dimensions: 1536,
    input: values,
  })

  return response.data.map((item) => item.embedding)
}
