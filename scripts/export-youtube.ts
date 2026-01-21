import 'dotenv/config';
import { writeFileSync } from 'fs';
import {
  extractChannelIdentifier,
  resolveChannelId,
  getFullAnalyticsByChannelId,
} from '../src/lib/youtube';

async function main() {
  const channelInput = process.argv[2] || '@bertovmill';

  console.log(`Fetching data for: ${channelInput}`);

  const identifier = extractChannelIdentifier(channelInput);
  if (!identifier) {
    console.error('Invalid channel identifier');
    process.exit(1);
  }

  const channelId = await resolveChannelId(identifier);
  if (!channelId) {
    console.error('Could not resolve channel ID');
    process.exit(1);
  }

  console.log(`Resolved channel ID: ${channelId}`);

  const analytics = await getFullAnalyticsByChannelId(channelId);
  if (!analytics) {
    console.error('Could not fetch analytics');
    process.exit(1);
  }

  const outputPath = './data/youtube-content.json';
  writeFileSync(outputPath, JSON.stringify(analytics, null, 2));

  console.log(`Exported ${analytics.videos.length} videos to ${outputPath}`);
  console.log(`Channel: ${analytics.channel.title}`);
  console.log(`Subscribers: ${analytics.channel.subscriberCount.toLocaleString()}`);
}

main().catch(console.error);
