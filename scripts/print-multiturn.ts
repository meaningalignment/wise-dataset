import fs from "node:fs"
import readline from "node:readline"
import { parseArgs } from "node:util"

interface Message {
  role: string
  content: string
}

interface Conversation {
  conversations: Message[]
}

function printConversation(conversation: Conversation) {
  console.log("=".repeat(50))
  conversation.conversations.forEach((message, index) => {
    const roleColor = message.role === "human" ? "\x1b[36m" : "\x1b[32m"
    console.log(`${roleColor}${message.role.toUpperCase()}:\x1b[0m`)
    console.log(message.content)
    if (index < conversation.conversations.length - 1) {
      console.log("-".repeat(50))
    }
  })
  console.log("=".repeat(50))
  console.log()
}

async function processJSONL(filePath: string) {
  const fileStream = fs.createReadStream(filePath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    try {
      const conversation: Conversation = JSON.parse(line)
      printConversation(conversation)
    } catch (error) {
      console.error("Error parsing line:", error)
    }
  }
}

// Add command line options parsing
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    input: { short: "i", type: "string" },
  },
  strict: true,
  allowPositionals: true,
})

const filePath = values.input

if (!filePath) {
  console.error("Please provide a JSONL file path using the -i option.")
  process.exit(1)
}

console.log(`Processing file: ${filePath}`)
processJSONL(filePath)
