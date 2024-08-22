import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function escapeCSV(field: unknown): string {
  if (
    typeof field === "string" &&
    (field.includes(",") || field.includes('"') || field.includes("\n"))
  ) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return String(field)
}

function convertJSONLToCSV(inputPath: string, outputPath: string): void {
  const data = fs
    .readFileSync(inputPath, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
  const allFields = new Set<string>()
  const jsonData = data.map((line) => {
    const obj = JSON.parse(line)
    Object.keys(obj).forEach((key) => allFields.add(key))
    return obj
  })

  const headers = Array.from(allFields)
  const csvRows = [headers.join(",")]

  jsonData.forEach((obj: Record<string, unknown>) => {
    const row = headers.map((header) => {
      const value = obj[header]
      if (typeof value === "object" && value !== null) {
        return escapeCSV(JSON.stringify(value))
      }
      return escapeCSV(value)
    })
    csvRows.push(row.join(","))
  })

  fs.writeFileSync(outputPath, csvRows.join("\n"))
}

const inputDir = path.join(__dirname, "outputs")
const outputDir = path.join(__dirname, "outputs", "csvs")

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

fs.readdirSync(inputDir).forEach((file) => {
  if (path.extname(file) === ".jsonl") {
    const inputPath = path.join(inputDir, file)
    const outputPath = path.join(
      outputDir,
      `${path.basename(file, ".jsonl")}.csv`
    )
    convertJSONLToCSV(inputPath, outputPath)
    console.log(`Converted ${file} to CSV`)
  }
})
