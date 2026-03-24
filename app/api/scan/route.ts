import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const image = body?.image;

  if (!image) {
    return NextResponse.json({ awarded: false });
  }

  return NextResponse.json({
    awarded: true,
    wine: 'Syrah Prestige 2023',
    producer: 'Château Horizon',
    country: 'Francia',
    medal: 'Grand Gold Medal',
    session: 'Concours Mondial de Bruxelles 2025',
    feedbackUrl: 'https://example.com/feedback/syrah-prestige-2023',
    productImageUrl: null,
  });
}