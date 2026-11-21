const OFFICIAL_LCR_ICAL_URL =
  'https://www.churchofjesuschrist.org/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180';

const FETCH_TIMEOUT_MS = 10000;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(OFFICIAL_LCR_ICAL_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'text/calendar, text/plain, */*',
        'User-Agent': 'EstacaEsteApp/1.0 (+https://estacaeste.vercel.app)',
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        error: `LCR upstream returned HTTP ${upstream.status}`,
      });
    }

    const icsText = await upstream.text();
    if (!icsText.includes('BEGIN:VCALENDAR')) {
      return res.status(502).json({
        error: 'LCR upstream did not return a valid iCalendar payload',
      });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(icsText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to fetch LCR calendar: ${message}` });
  } finally {
    clearTimeout(timeoutId);
  }
}
