const OFFICIAL_LCR_ICAL_URL =
  process.env.LCR_ICAL_URL ||
  'https://www.churchofjesuschrist.org/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180';

// 7 segundos: margen seguro por debajo del límite de 10s en Vercel Hobby y del timeout de 9.5s del cliente
const FETCH_TIMEOUT_MS = 7000;

const ALLOWED_HOST_PATTERNS = [
  /^estacaeste\.vercel\.app$/i,
  /^estaca-este-app(?:-[a-z0-9-]+)?\.vercel\.app$/i,
  /^localhost(?::\d+)?$/i,
  /^127\.0\.0\.1(?::\d+)?$/i,
];

function isAllowedRequestOrigin(req) {
  const secFetchSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'same-origin') {
    return true;
  }

  const originOrReferer = req.headers?.origin || req.headers?.referer || '';
  if (originOrReferer) {
    try {
      const parsed = new URL(String(originOrReferer));
      return ALLOWED_HOST_PATTERNS.some((re) => re.test(parsed.host));
    } catch {
      return false;
    }
  }

  // Solicitudes directas sin Origin/Referer solo si apuntan al host autorizado en desarrollo/mismo servidor
  const host = String(req.headers?.host || '');
  return /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/i.test(host);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedRequestOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' });
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
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(icsText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to fetch LCR calendar: ${message}` });
  } finally {
    clearTimeout(timeoutId);
  }
}
