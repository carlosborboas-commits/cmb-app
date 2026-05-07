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

function detectMedal(snippet: string) {
  const s = normalize(snippet);

  if (s.includes('gran medalla de oro')) return 'Gran Medalla de Oro';
  if (s.includes('medalla de oro')) return 'Medalla de Oro';
  if (s.includes('medalla de plata')) return 'Medalla de Plata';
  if (s.includes('cmb merit')) return 'CMB Merit';
  if (s.includes('revelacion') || s.includes('revelation')) return 'Revelación CMB';

  return 'Premio CMB';
}

function detectSession(snippet: string) {
  const s = normalize(snippet);

  if (s.includes('vinos tintos y blancos')) {
    return 'Sesión Vinos Tintos y Blancos';
  }

  if (s.includes('vinos dulces')) {
    return 'Sesión Vinos Dulces y Fortificados';
  }

  if (s.includes('vinos espumosos')) {
    return 'Sesión Vinos Espumosos';
  }

  if (s.includes('vinos rosados')) {
    return 'Sesión Vinos Rosados';
  }

  return 'Concours Mondial de Bruxelles';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedTextRaw = body.detectedText || body.image || '';
    const detectedText = normalize(detectedTextRaw);

    const primaryWineName = detectedText
      .split(' ')
      .filter((w: string) => w.length > 3)
      .slice(0, 4)
      .join(' ');

    let bestMatch: any = null;

    for (const year of YEARS) {
      const url = `https://results.concoursmondial.com/es/resultados/${year}`;

      const response = await fetch(url, {
        cache: 'no-store',
      });

      const html = await response.text();

      const normalizedHtml = normalize(html);

      const index = normalizedHtml.indexOf(primaryWineName);

      if (index === -1) continue;

      const snippet = normalizedHtml.slice(
        Math.max(0, index - 1200),
        Math.min(normalizedHtml.length, index + 2500)
      );

      const medal = detectMedal(snippet);
      const session = detectSession(snippet);

      const score =
        primaryWineName
          .split(' ')
          .filter((word: string) => snippet.includes(word)).length || 0;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          year,
          medal,
          session,
          snippet,
          score,
          url:
            `https://results.concoursmondial.com/es/resultados/${year}`,
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
      wine: display(primaryWineName),
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