import { NextResponse } from 'next/server';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string) {
  return normalize(value)
    .replace(/\b(the|and|de|del|la|el|le|les|du|di|da)\b/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLinks(html: string) {
  const links = Array.from(
    html.matchAll(/href=["']([^"']*\/es\/resultados\/\d{4}\/[^"']+)["']/g)
  ).map((m) => m[1]);

  return Array.from(new Set(links)).map((link) =>
    link.startsWith('http') ? link : `https://results.concoursmondial.com${link}`
  );
}

function getSlug(url: string) {
  return slugify(decodeURIComponent(url.split('/').pop() || ''));
}

function detectMedal(text: string) {
  const s = normalize(text);

  if (s.includes('international red wine revelation')) {
    return 'Gran Medalla de Oro · International Red Wine Revelation';
  }

  if (s.includes('gran medalla de oro') || s.includes('grand gold medal')) {
    return 'Gran Medalla de Oro';
  }

  if (s.includes('medalla de oro') || s.includes('gold medal')) {
    return 'Medalla de Oro';
  }

  if (s.includes('medalla de plata') || s.includes('silver medal')) {
    return 'Medalla de Plata';
  }

  return 'Premio CMB';
}

function detectSession(text: string) {
  const s = normalize(text);

  if (s.includes('vinos tintos y blancos') || s.includes('red wine')) {
    return 'Sesión Vinos Tintos y Blancos';
  }

  if (s.includes('vinos dulces') || s.includes('sweet')) {
    return 'Sesión Vinos Dulces y Fortificados';
  }

  if (s.includes('vinos espumosos') || s.includes('sparkling')) {
    return 'Sesión Vinos Espumosos';
  }

  if (s.includes('vinos rosados') || s.includes('rose')) {
    return 'Sesión Vinos Rosados';
  }

  return 'Concours Mondial de Bruxelles';
}

function extractImage(html: string) {
  const candidates = [
    ...Array.from(html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map((m) => m[1]),
    ...Array.from(html.matchAll(/https?:\/\/[^"'()\s]+\.(?:jpg|jpeg|png|webp)[^"'()\s]*/gi)).map((m) => m[0]),
  ];

  const selected =
    candidates.find((u) => normalize(u).includes('linked')) ||
    candidates.find((u) => normalize(u).includes('reg')) ||
    candidates[0];

  if (!selected) return null;
  return selected.startsWith('http')
    ? selected
    : `https://results.concoursmondial.com${selected}`;
}

function wineNameFromSlug(url: string) {
  return decodeURIComponent(url.split('/').pop() || '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractCountry(text: string) {
  const country =
    text.match(/País\s+([A-Za-zÀ-ÿ\s]+?)(?:Región|Denominación|Medalla|$)/i)?.[1] ||
    text.match(/Country\s+([A-Za-zÀ-ÿ\s]+?)(?:Region|Appellation|Medal|$)/i)?.[1];

  const region =
    text.match(/Región Vinícola\s+([A-Za-zÀ-ÿ\s]+?)(?:Denominación|Medalla|$)/i)?.[1] ||
    text.match(/Wine Region\s+([A-Za-zÀ-ÿ\s]+?)(?:Appellation|Medal|$)/i)?.[1];

  if (country && region) return `${country.trim()} · ${region.trim()}`;
  return country?.trim() || region?.trim() || 'Official CMB result';
}

function matchScore(candidateSlug: string, targetSlug: string) {
  const targetWords = targetSlug.split('-').filter(Boolean);
  const candidateWords = candidateSlug.split('-').filter(Boolean);

  let score = 0;

  for (const word of targetWords) {
    if (candidateWords.includes(word)) score += 1;
  }

  return score / Math.max(targetWords.length, 1);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = String(body.wineName || '').trim();
    const producer = String(body.producer || '').trim();
    const vintage = String(body.vintage || '').trim();
    const detectedText = String(body.detectedText || body.image || '').trim();

    const baseName = wineName || detectedText.split('\n')[0] || '';
    const targetSlug = slugify([baseName, vintage].filter(Boolean).join(' '));

    if (!targetSlug || targetSlug.length < 4) {
      return NextResponse.json({ awarded: false });
    }

    let best: any = null;

    for (const year of YEARS) {
      const listingUrl = `https://results.concoursmondial.com/es/resultados/${year}`;
      const listingHtml = await fetch(listingUrl, { cache: 'no-store' }).then((r) => r.text());
      const links = findLinks(listingHtml);

      for (const link of links) {
        const candidateSlug = getSlug(link);
        const score = matchScore(candidateSlug, targetSlug);

        const vintageMatch = vintage ? candidateSlug.includes(slugify(vintage)) : true;

        if (score < 0.65 || !vintageMatch) continue;

        const html = await fetch(link, { cache: 'no-store' }).then((r) => r.text());
        const text = cleanHtml(html);
        const normalizedText = normalize(text);

        const producerOk = producer
          ? normalizedText.includes(normalize(producer).split(' ')[0])
          : true;

        if (!producerOk && score < 0.85) continue;

        if (!best || score > best.score) {
          best = {
            score,
            year,
            url: link,
            text,
            wine: wineNameFromSlug(link),
            medal: detectMedal(text),
            session: detectSession(text),
            country: extractCountry(text),
            imageUrl: extractImage(html),
          };
        }
      }
    }

    if (!best) {
      return NextResponse.json({ awarded: false });
    }

    return NextResponse.json({
      awarded: true,
      wine: best.wine,
      producer: producer || 'Official CMB result',
      country: best.country,
      medal: best.medal,
      session: `${best.session} · ${best.year}`,
      feedbackUrl: best.url,
      productImageUrl: best.imageUrl,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ awarded: false });
  }
}