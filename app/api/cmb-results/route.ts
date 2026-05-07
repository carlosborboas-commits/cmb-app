import { NextResponse } from 'next/server';

function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export async function POST(req: Request) {
  const body = await req.json();

  const image = body?.image;

  if (!image) {
    return NextResponse.json({
      awarded: false,
    });
  }

  // 🔥 Simulación OCR temporal
  const detectedWine = 'Casa Madero';

  const response = await fetch(
    'https://results.concoursmondial.com/es/resultados/2025',
    {
      cache: 'no-store',
    }
  );

  const html = await response.text();

  const text = cleanText(html);

  const found = text.includes(
    detectedWine.toLowerCase()
  );

  if (!found) {
    return NextResponse.json({
      awarded: false,
    });
  }

  return NextResponse.json({
    awarded: true,
    wine: detectedWine,
    producer: 'Detected in official CMB results',
    country: 'Mexico',
    medal: 'Award detected',
    session: 'Concours Mondial de Bruxelles 2025',
    feedbackUrl:
      'https://results.concoursmondial.com/es/resultados/2025',
    productImageUrl: null,
  });
}