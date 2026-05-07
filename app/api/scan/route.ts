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

function display(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function medalFromSnippet(snippet: string) {
  const s = normalize(snippet);

  if (s.includes('gran medalla de oro')) return 'Gran Medalla de Oro';
  if (s.includes('medalla de oro')) return 'Medalla de Oro';
  if (s.includes('medalla de plata')) return 'Medalla de Plata';
  if (s.includes('cmb merit')) return 'CMB Merit';
  if (s.includes('revelacion') || s.includes('revelation')) return 'Revelación CMB';

  return 'Premio CMB detectado';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedTextRaw = body.detectedText || body.image || '';
    const detectedText = normalize(detectedTextRaw);

    const words = detectedText
      .split(' ')
      .filter((word: string) => word.length > 3)
      .slice(0, 20);

    let bestMatch: any = null;

    for (const year of YEARS) {
      const url = `https://results.concoursmondial.com/es/resultados/${year}`;

      const response = await fetch(url, { cache: 'no-store' });
      const html = await response.text();
      const text = normalize(html);

      let score = 0;

      for (const word of words) {
        if (text.includes(word)) score++;
      }

      if (score >= 2) {
        const firstWord = words.find((word: string) => text.includes(word)) || '';
        const index = firstWord ? text.indexOf(firstWord) : 0;

        const snippet = text.slice(
          Math.max(0, index - 600),
          Math.min(text.length, index + 1200)
        );

        const medal = medalFromSnippet(snippet);

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            year,
            score,
            medal,
            snippet: display(snippet),
            url,
          };
        }
      }
    }

    if (!bestMatch) {
      return NextResponse.json({
        awarded: false,
        matchedYear: '',
        matchedMedal: '',
        matchedSnippet: '',
      });
    }

    return NextResponse.json({
      awarded: true,
      wine: display(detectedTextRaw) || 'CMB Awarded Wine',
      producer: 'Detected from CMB public results',
      country: 'Detected',
      medal: bestMatch.medal,
      session: `Concours Mondial de Bruxelles ${bestMatch.year}`,
      feedbackUrl: bestMatch.url,
      productImageUrl: null,

      matchedYear: bestMatch.year,
      matchedMedal: bestMatch.medal,
      matchedSnippet: bestMatch.snippet,
      matchScore: bestMatch.score,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
      matchedYear: '',
      matchedMedal: '',
      matchedSnippet: '',
    });
  }
}