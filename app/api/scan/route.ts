import { NextResponse } from 'next/server';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function display(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function detectMedal(text: string) {
  const s = normalize(text);

  if (s.includes('gran medalla de oro')) return 'Gran Medalla de Oro';
  if (s.includes('grand gold medal')) return 'Gran Medalla de Oro';
  if (s.includes('medalla de oro')) return 'Medalla de Oro';
  if (s.includes('gold medal')) return 'Medalla de Oro';
  if (s.includes('medalla de plata')) return 'Medalla de Plata';
  if (s.includes('silver medal')) return 'Medalla de Plata';
  if (s.includes('international red wine revelation')) return 'International Red Wine Revelation';

  return 'Premio CMB';
}

function detectSession(text: string) {
  const s = normalize(text);

  if (s.includes('red wine') || s.includes('vinos tintos y blancos')) {
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

function extractCandidateTerms(text: string) {
  const normalized = normalize(text);

  const words = normalized
    .split(' ')
    .filter((word) => word.length > 3)
    .filter(
      (word) =>
        ![
          'wine',
          'vino',
          'vinos',
          'label',
          'bottle',
          'gran',
          'medalla',
          'oro',
          'plata',
          'concours',
          'mondial',
          'bruxelles',
          'appellation',
          'contiene',
          'alcohol',
          'producto',
        ].includes(word)
    );

  return Array.from(new Set(words)).slice(0, 20);
}

function findResultLinks(html: string, year: string) {
  const links = Array.from(
    html.matchAll(/href=["']([^"']*\/es\/resultados\/\d{4}\/[^"']+)["']/g)
  ).map((match) => match[1]);

  return Array.from(new Set(links)).map((link) => {
    if (link.startsWith('http')) return link;
    return `https://results.concoursmondial.com${link}`;
  });
}

async function getText(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  const html = await response.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { html, text, normalized: normalize(text) };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedTextRaw = body.detectedText || body.image || '';
    const terms = extractCandidateTerms(detectedTextRaw);

    let bestMatch: any = null;

    for (const year of YEARS) {
      const listingUrl = `https://results.concoursmondial.com/es/resultados/${year}`;
      const { html, normalized } = await getText(listingUrl);

      const links = findResultLinks(html, year);

      for (const link of links) {
        const slug = normalize(link.split('/').pop() || '');

        let slugScore = 0;

        for (const term of terms) {
          if (slug.includes(term)) slugScore += 4;
          if (normalized.includes(term)) slugScore += 1;
        }

        if (slugScore < 4) continue;

        const detail = await getText(link);

        let score = slugScore;

        for (const term of terms) {
          if (detail.normalized.includes(term)) score += 3;
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            score,
            year,
            url: link,
            text: detail.text,
            medal: detectMedal(detail.text),
            session: detectSession(detail.text),
          };
        }
      }
    }

    if (!bestMatch) {
      return NextResponse.json({
        awarded: false,
      });
    }

    const cleanWine =
      bestMatch.text.match(/Balasto\s*\d{4}/i)?.[0] ||
      display(detectedTextRaw.split('\n')[0] || detectedTextRaw) ||
      'CMB Awarded Wine';

    return NextResponse.json({
      awarded: true,
      wine: cleanWine,
      producer: 'Detected from CMB public results',
      country: 'Detected',
      medal: bestMatch.medal,
      session: `${bestMatch.session} · ${bestMatch.year}`,
      feedbackUrl: bestMatch.url,
      productImageUrl: null,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
    });
  }
}