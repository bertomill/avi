import { MediumArticleData, MediumAnalytics } from '@/types';

/**
 * Fetch and parse Medium RSS feed for a given username
 */
export async function fetchMediumArticles(username: string): Promise<MediumArticleData[]> {
  const feedUrl = `https://medium.com/feed/@${username}`;

  const response = await fetch(feedUrl, {
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Medium feed: ${response.status}`);
  }

  const xmlText = await response.text();
  return parseRssFeed(xmlText);
}

/**
 * Parse RSS XML to article data
 */
function parseRssFeed(xml: string): MediumArticleData[] {
  const articles: MediumArticleData[] = [];

  // Extract items using regex (works in Node.js without DOMParser)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const guid = extractTag(itemXml, 'guid');
    const pubDate = extractTag(itemXml, 'pubDate');
    const creator = extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'creator');
    const contentEncoded = extractCDATA(itemXml, 'content:encoded') || extractTag(itemXml, 'description');

    // Extract categories
    const categories: string[] = [];
    const categoryRegex = /<category[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/g;
    let catMatch;
    while ((catMatch = categoryRegex.exec(itemXml)) !== null) {
      categories.push(catMatch[1].trim());
    }

    if (title && link) {
      articles.push({
        id: guid || link,
        title: decodeHtmlEntities(title),
        link,
        publishedAt: pubDate || '',
        contentPreview: extractPreview(contentEncoded || '', 200),
        categories,
        author: creator || '',
      });
    }
  }

  return articles;
}

/**
 * Extract content from an XML tag
 */
function extractTag(xml: string, tagName: string): string {
  // Handle CDATA content
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Handle regular content
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract CDATA content specifically
 */
function extractCDATA(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Strip HTML and decode entities to create a preview
 */
function extractPreview(htmlContent: string, maxLength: number = 200): string {
  // Remove HTML tags
  let text = htmlContent.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Truncate and add ellipsis
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).trim() + '...';
  }

  return text;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x2019;': "'",
    '&#x2018;': "'",
    '&#x201C;': '"',
    '&#x201D;': '"',
    '&#x2014;': '—',
    '&#x2013;': '–',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}

/**
 * Get full analytics structure for a Medium user
 */
export async function getMediumAnalytics(username: string): Promise<MediumAnalytics | null> {
  try {
    const articles = await fetchMediumArticles(username);

    // Get unique categories across all articles
    const allCategories = [...new Set(articles.flatMap(a => a.categories))];

    return {
      username,
      articles,
      recentActivity: {
        totalArticles: articles.length,
        latestPublishedAt: articles[0]?.publishedAt || null,
        categories: allCategories,
      },
    };
  } catch (error) {
    console.error('Error fetching Medium analytics:', error);
    return null;
  }
}

/**
 * Validate that a Medium username exists by checking if feed returns valid data
 */
export async function validateMediumUsername(username: string): Promise<boolean> {
  try {
    const feedUrl = `https://medium.com/feed/@${username}`;
    const response = await fetch(feedUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      return false;
    }

    // Check if the response contains RSS content
    const text = await response.text();
    return text.includes('<rss') || text.includes('<channel>');
  } catch {
    return false;
  }
}
