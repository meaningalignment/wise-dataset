# WiseDataset: Synthetic Values-Laden Conversations for AI Training

This repository generates synthetic datasets of values-laden conversations designed to train language models to provide wiser responses to a variety of user queries. These datasets aim to improve AI responses to:

- Harmful questions, where typical models might refuse or lecture
- Heavy questions, which often receive generic advice
- Exploratory questions, where opportunities for inspiration are often missed

The datasets are created using a prompt chain that reasons about the user's situation and identifies meaningful "attention policies" - considerations that are important in themselves, not just as means to an end. This approach aims to produce responses that are more empathetic, insightful, and truly helpful to users.

The generated data is explicit with what values are applied when. This is done by interspersing values tags in the response.

For example:

```
I hear you, <value choice-type="forbidden thrills" consideration="FEELINGS of being fully alive and present in the moment">Engaging in extreme sports can provide an intense rush of adrenaline and excitement</value>
```

For more on this format, please see our [paper](https://arxiv.org/abs/2404.10636).

## Overview

This project includes scripts and tools for generating, processing, and formatting data for training LLMs like [WiseLLaMa-8B](https://huggingface.co/meaningalignment/wise-llama).

## Installation

To install dependencies:

```bash
bun install
```

## Generating Data

### Basic Data Generation

To generate basic data:

```bash
bun run index.ts
```

You can customize the input file, number of responses, and output label:

```bash
bun run index.ts -- -i inputs/custom_input.txt -n 100 -l custom_output
```

### Multi-turn Conversations

To generate multi-turn conversations:

```bash
bun run multi.ts -- -i inputs/data.jsonl -n 250 -s 0
```

### Shuffling Values

To shuffle values in the dataset:

```bash
bun run shuffle.ts -- -i inputs/your_input_file.jsonl -o outputs/shuffled_output.jsonl
```

## Processing Data for Training

### OpenAI API Format

To format data for training through OpenAI's API:

```bash
bun run scripts/make-gpt4o-training-data.ts outputs/data.jsonl
```

### LLaMa SFT/DPO Format

To format data for SFT/DPO training with LLaMa:

```bash
bun run scripts/make-llama-training-data.ts outputs/data_1.jsonl outputs/data_2.jsonl
```

## Additional Scripts

- Generate mixed input:
  ```bash
  bun run generate_mixed_input > inputs/mixed.txt
  ```

- Convert JSONL to CSV:
  ```bash
  bun run scripts/jsonl-to-csv.ts
  ```

- Show reasoning for a specific line in a JSONL file:
  ```bash
  bun run scripts/show-reasoning.ts output_file.jsonl line_number
  ```

## Project Structure

- `index.ts`: Main script for generating basic dataset
- `multi.ts`: Script for generating multi-turn conversations
- `shuffle.ts`: Script for shuffling values in the dataset
- `scripts/`: Contains various utility scripts for data processing and formatting
- `ai/`: Contains AI-related functions and prompts