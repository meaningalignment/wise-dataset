#!/usr/bin/env bun
const filename = Bun.argv[2]
const line_number = parseInt(Bun.argv[3])

console.log(`Showing ${filename} line ${line_number}...`)
const line = (await Bun.file(filename).text()).split('\n')[line_number]
const json = JSON.parse(line)
const area = json['reasoning']['context_reasoning']

const bat = Bun.spawn(['bat', '-lmd'], { stdin: 'pipe', stdout: 'inherit' })
bat.stdin.write(Object.entries(area).map(([key, value]) => `# ${key}\n\n${value}`).join('\n\n'))
bat.stdin.flush()
bat.stdin.end()
