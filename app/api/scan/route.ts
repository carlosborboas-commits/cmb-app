import { NextResponse } from 'next/server';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9ñü\s\-']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function detectMedal(text: string) {
  const s = normalize(text);

  if (s.includes('international red wine revelation')) {
    return 'Gran Medalla de Oro · International Red Wine Revelation';
  }

  if (
    s.includes('gran medalla de oro') ||
    s.includes('grand gold medal') ||
    s.includes('grande medaille d or')
  ) {
    return 'Gran Medalla de Oro';
  }

  if (
    s.includes('medalla de oro') ||
    s.includes('gold medal') ||
    s.includes('medaille d or')
  ) {
    return 'Medalla de Oro';
  }

  if (s.includes('medalla de plata') || s.includes('silver medal')) {
    return 'Medalla de Plata';
  }

  if (s.includes('cmb merit')) {
    return 'CMB Merit';
  }

  return 'Premio CMB';
}

function detectSession(text: string) {
  const s = normalize(text);

  if (
    s.includes('vinos tintos y blancos') ||
    s.includes('red and white wines') ||
    s.includes('red wine')
  ) {
    return 'Sesión Vinos Tintos y Blancos';
  }

  if (s.includes('vinos dulces') || s.includes('sweet') || s.includes('fortified')) {
    return 'Sesión Vinos Dulces y Fortificados';
  }

  if (s.includes('vinos espumosos') || s.includes('sparkling')) {
    return 'Sesión Vinos Espumosos';
  }

  if (s.includes('vinos rosados') || s.includes('rose') || s.includes('rosé')) {
    return 'Sesión Vinos Rosados';
  }

  return 'Concours Mondial de Bruxelles';
}

function importantTerms(value: string) {
  const stopwords = new Set([
    'wine',
    'vino',
    'vinos',
    'label',
    'bottle',
    'estate',
    'reserve',
    'reserva',
    'gran',
    'medalla',
    'gold',
    'oro',
    'silver',
    'plata',
    'concours',
    'mondial',
    'bruxelles',
    'alcohol',
    'contains',
    'contiene',
    'product',
    'producto',
    'appellation',
    'denomination',
    'cabernet',
    'sauvignon',
    'merlot',
    'malbec',
    'syrah',
    'chardonnay',
  ]);

  return Array.from(
    new Set(
      normalize(value)
        .split(' ')
        .filter((word) => word.length > 2)
        .filter((word) => !stopwords.has(word))
    )
  );
}

function findResultLinks(html: string) {
  const links = Array.from(
    html.matchAll(/href=["']([^"']*\/es\/resultados\/\d{4}\/[^"']+)["']/g)
  ).map((match) => match[1]);

  return Array.from(new Set(links)).map((link) => {
    if (link.startsWith('http')) return link;
    return `https://results.concoursmondial.com${link}`;
  });
}

function getSlug(url: string) {
  return normalize(decodeURIComponent(url.split('/').pop() || ''));
}

function extractImage(html: string) {
  const candidates = [
    ...Array.from(html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map((m) => m[1]),
    ...Array.from(html.matchAll(/data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map((m) => m[1]),
    ...Array.from(html.matchAll(/https?:\/\/[^"'()\s]+\.(?:jpg|jpeg|png|webp)[^"'()\s]*/gi)).map((m) => m[0]),
  ];

  const preferred = candidates.find((url) =>
    normalize(url).includes('linked') || normalize(url).includes('reg')
  );

  const selected = preferred || candidates[0];

  if (!selected) return null;
  if (selected.startsWith('http')) return selected;
  return `https://results.concoursmondial.com${selected}`;
}

function extractWineNameFromSlug(url: string) {
  const slug = decodeURIComponent(url.split('/').pop() || '');
  const withoutId = slug.replace(/^\d+-/, '');
  const clean = withoutId.replace(/-/g, ' ');
  return titleCase(clean);
}

function extractCountryRegion(text: string) {
  const s = text.replace(/\s+/g, ' ');

  const countryRegion =
    s.match(/País\s+([^·|]{2,80})/i)?.[1] ||
    s.match(/Country\s+([^·|]{2,80})/i)?.[1] ||
    '';

  const region =
    s.match(/Región Vinícola\s+([^·|]{2,80})/i)?.[1] ||
    s.match(/Wine Region\s+([^·|]{2,80})/i)?.[1] ||
    '';

  if (countryRegion && region) return `${countryRegion.trim()} · ${region.trim()}`;
  return (countryRegion || region || 'Official CMB result').trim();
}

async function fetchHtml(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  return response.text();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedTextRaw = body.detectedText || body.image || '';
    const wineName = body.wineName || '';
    const producer = body.producer || '';
    const vintage = body.vintage || '';

    const queryText = [wineName, producer, vintage, detectedTextRaw].filter(Boolean).join(' ');
    const terms = importantTerms(queryText);

    if (terms.length === 0) {
      return NextResponse.json({ awarded: false });
    }

    let bestMatch: any = null;

    for (const year of YEARS) {
      const listingUrl = `https://results.concoursmondial.com/es/resultados/${year}`;
      const listingHtml = await fetchHtml(listingUrl);
      const links = findResultLinks(listingHtml);

      for (const link of links) {
        const slug = getSlug(link);

        let score = 0;

        for (const term of terms) {
          if (slug.includes(term)) score += 8;
        }

        if (vintage && slug.includes(normalize(vintage))) score += 12;

        if (score < 8) continue;

        const detailHtml = await fetchHtml(link);
        const detailText = cleanTextFromHtml(detailHtml);
        const detailNormalized = normalize(detailText);

        for (const term of terms) {
          if (detailNormalized.includes(term)) score += 3;
        }

        if (producer && detailNormalized.includes(normalize(producer))) score += 8;
        if (vintage && detailNormalized.includes(normalize(vintage))) score += 8;

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            score,
            year,
            url: link,
            html: detailHtml,
            text: detailText,
            wine: extractWineNameFromSlug(link),
            medal: detectMedal(detailText),
            session: detectSession(detailText),
            country: extractCountryRegion(detailText),
            imageUrl: extractImage(detailHtml),
          };
        }
      }
    }

    if (!bestMatch || bestMatch.score < 12) {
      return NextResponse.json({ awarded: false });
    }

    return NextResponse.json({
      awarded: true,
      wine: bestMatch.wine,
      producer: producer || 'Official CMB result',
      country: bestMatch.country,
      medal: bestMatch.medal,
      session: `${bestMatch.session} · ${bestMatch.year}`,
      feedbackUrl: bestMatch.url,
      productImageUrl: bestMatch.imageUrl,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ awarded: false });
  }
}