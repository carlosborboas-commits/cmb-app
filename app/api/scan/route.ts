import { NextResponse } from 'next/server';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDisplay(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function detectMedal(text: string) {
  const normalized = normalize(text);

  if (normalized.includes('gran medalla de oro')) return 'Gran Medalla de Oro';
  if (normalized.includes('medalla de oro')) return 'Medalla de Oro';
  if (normalized.includes('medalla de plata')) return 'Medalla de Plata';
  if (normalized.includes('cmb merit')) return 'CMB Merit';
  if (normalized.includes('revelacion') || normalized.includes('revelation')) return 'Revelación CMB';

  return 'Medalla CMB';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedText = normalize(body.detectedText || body.image || '');

    const words = detectedText
      .split(' ')
      .filter((word: string) => word.length > 3)
      .slice(0, 18);

    let bestMatch: {
      year: string;
      score: number;
      medal: string;
      snippet: string;
      url: string;
    } | null = null;

    for (const year of YEARS) {
      const url = `https://results.concoursmondial.com/es/resultados/${year}`;

      const response = await fetch(url, {
        cache: 'no-store',
      });

      const html = await response.text();
      const text = normalize(html);

      let score = 0;

      for (const word of words) {
        if (text.includes(word)) {
          score++;
        }
      }

      if (score >= 2 && (!bestMatch || score > bestMatch.score)) {
        const firstMatchedWord = words.find((word: string) => text.includes(word));
        const index = firstMatchedWord ? text.indexOf(firstMatchedWord) : 0;
        const snippet = text.slice(Math.max(0, index - 250), index + 500);

        bestMatch = {
          year,
          score,
          medal: detectMedal(snippet),
          snippet: cleanDisplay(snippet),
          url,
        };
      }
    }

    if (!bestMatch) {
      return NextResponse.json({
        awarded: false,
      });
    }

    return NextResponse.json({
      awarded: true,
      wine: cleanDisplay(body.detectedText || 'CMB Awarded Wine'),
      producer: 'Detected from CMB public results',
      country: 'Detected',
      medal: bestMatch.medal,
      session: `Concours Mondial de Bruxelles ${bestMatch.year}`,
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