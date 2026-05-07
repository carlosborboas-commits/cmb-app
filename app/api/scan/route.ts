import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const detectedText =
      (body.detectedText || body.image || '')
        .toLowerCase()
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    console.log('OCR RECEIVED:', detectedText);

    const response = await fetch(
      'https://results.concoursmondial.com/es/resultados/2025'
    );

    const html = await response.text();

    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    const words = detectedText
      .split(' ')
      .filter((w: string) => w.length > 3);

    let matched = false;

    for (const word of words) {
      if (text.includes(word)) {
        matched = true;
        console.log('MATCH FOUND:', word);
        break;
      }
    }

    if (matched) {
      return NextResponse.json({
        awarded: true,
        wine: detectedText.toUpperCase(),
        producer: 'Detected from CMB public results',
        country: 'Detected',
        medal: 'CMB Match',
        session: 'Concours Mondial de Bruxelles 2025',
        feedbackUrl:
          'https://results.concoursmondial.com/es/resultados/2025',
        productImageUrl: null,
      });
    }

    return NextResponse.json({
      awarded: false,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
    });
  }
}