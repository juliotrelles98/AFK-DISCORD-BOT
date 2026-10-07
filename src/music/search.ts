import { execFile } from 'child_process';
import { promisify } from 'util';
import play from 'play-dl';

const execFileAsync = promisify(execFile);

export interface SearchResult {
  title: string;
  url: string;
  duration: number; // in seconds
  thumbnail?: string;
  artist?: string;
}

/**
 * Search for a track using play-dl (fast) and fallback to yt-dlp.
 */
export async function searchMusic(query: string): Promise<SearchResult | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  // Try play-dl first (fastest)
  try {
    const results = await play.search(cleanQuery, { limit: 1, source: { youtube: 'video' } });
    if (results && results.length > 0) {
      const item = results[0];
      return {
        title: item.title ?? cleanQuery,
        url: item.url,
        duration: item.durationInSec ?? 0,
        thumbnail: item.thumbnails?.[0]?.url,
        artist: item.channel?.name,
      };
    }
  } catch (err) {
    console.warn('[SEARCH] play-dl search failed, trying yt-dlp fallback:', err);
  }

  // Fallback: yt-dlp
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--default-search', 'ytsearch1:',
      '--print', '%(title)s###%(webpage_url)s###%(duration)s',
      '--no-playlist',
      cleanQuery,
    ]);

    const line = stdout.trim().split('\n')[0];
    if (line) {
      const [title, url, durationStr] = line.split('###');
      return {
        title: title || cleanQuery,
        url: url || `ytsearch1:${cleanQuery}`,
        duration: parseInt(durationStr, 10) || 0,
      };
    }
  } catch (err) {
    console.error('[SEARCH] yt-dlp search error:', err);
  }

  return null;
}
