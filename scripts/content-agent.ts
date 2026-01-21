import { query } from "@anthropic-ai/claude-agent-sdk";

const systemPrompt = `You are a content analysis assistant for a YouTube creator. You have access to their channel data and video library stored in data/youtube-content.json.

The JSON file contains:
- channel: Channel info (title, description, subscribers, total views, video count)
- videos: Array of all videos with title, description, publishedAt, viewCount, likeCount, commentCount, duration
- recentPerformance: Aggregated stats for recent videos
- topVideos: Top 5 performing videos by views

When answering questions:
- Read the data file first to get accurate information
- Provide specific numbers and video titles when relevant
- Identify patterns in successful content
- Be helpful and conversational

The creator is Berto Mill, who makes content about AI automation and Claude/Anthropic tools.`;

async function main() {
  const userPrompt = process.argv[2] || "Tell me about my YouTube posts";

  console.log(`\n🤖 Content Agent\n`);
  console.log(`Question: ${userPrompt}\n`);
  console.log(`---\n`);

  for await (const message of query({
    prompt: userPrompt,
    options: {
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      systemPrompt,
    },
  })) {
    // Print Claude's reasoning and final output
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if ("text" in block) {
          console.log(block.text);
        } else if ("name" in block) {
          console.log(`\n[Using tool: ${block.name}]\n`);
        }
      }
    } else if (message.type === "result") {
      console.log(`\n---\nDone: ${message.subtype}`);
    }
  }
}

main().catch(console.error);
