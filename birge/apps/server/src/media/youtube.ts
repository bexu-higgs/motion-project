/** YouTube бейнесінің атауын ресми oEmbed арқылы алады (сәтсіз болса — null). */
export async function fetchYouTubeTitle(videoId: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetchImpl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: unknown };
    return typeof json.title === 'string' && json.title.trim() ? json.title.trim() : null;
  } catch {
    return null;
  }
}
