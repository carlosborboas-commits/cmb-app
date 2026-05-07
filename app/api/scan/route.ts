import { NextResponse } from 'next/server';

const YEARS = [
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
];

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

    const words = detectedText
      .split(' ')
      .filter((w: string) => w.length > 3);

    let matchedYear = '';

    for (const year of YEARS) {
      try {
        const response = await fetch(
          `https://results.concoursmondial.com/es/resultados/${year}`
        );

        const html = await response.text();

        const text = html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .toLowerCase();

        let score = 0;

        for (const word of words) {
          if (text.includes(word)) {
            score++;
          }
        }

        console.log(year, 'score:', score);

        if (score >= 2) {
          matchedYear = year;
          break;
        }
      } catch (err) {
        console.error('YEAR ERROR:', year, err);
      }
    }

    if (matchedYear) {
      return NextResponse.json({
        awarded: true,
        wine: detectedText.toUpperCase(),
        producer: 'Detected from CMB historical results',
        country: 'Detected',
        medal: 'CMB Match',
        session: `Concours Mondial de Bruxelles ${matchedYear}`,
        feedbackUrl:
          `https://results.concoursmondial.com/es/resultados/${matchedYear}`,
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