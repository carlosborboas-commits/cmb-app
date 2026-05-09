import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string) {
  const aa = normalize(a).split(' ').filter(Boolean);
  const bb = normalize(b).split(' ').filter(Boolean);

  let score = 0;

  for (const word of aa) {
    if (bb.includes(word)) score++;
  }

  return score / Math.max(aa.length, 1);
}

function yearNumber(value: any) {
  const year = Number(String(value || '').match(/\d{4}/)?.[0] || 0);
  return Number.isFinite(year) ? year : 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = body.wineName || '';
    const producer = body.producer || '';
    const vintage = body.vintage || '';
    const detectedText = body.detectedText || '';

    const searchText = [
      wineName,
      producer,
      vintage,
      detectedText,
    ].join(' ');

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(raw);

    let bestMatch: any = null;
    let bestScore = 0;

    for (const item of records) {
      const wineScore = similarity(
        `${wineName} ${vintage}`,
        `${item.wineName} ${item.vintage}`
      );

      const producerScore = similarity(
        producer,
        item.producer
      );

      const textScore = similarity(
        searchText,
        `${item.wineName} ${item.producer} ${item.vintage}`
      );

      const total =
        wineScore * 0.5 +
        producerScore * 0.3 +
        textScore * 0.2;

      const itemYear = yearNumber(item.year);
      const bestYear = yearNumber(bestMatch?.year);

      const isBetterMatch = total > bestScore;
      const isSameWineNewerAward =
        bestMatch &&
        total >= bestScore * 0.92 &&
        itemYear > bestYear;

      if (isBetterMatch || isSameWineNewerAward) {
        bestScore = total;
        bestMatch = item;
      }
    }

    if (!bestMatch || bestScore < 0.45) {
      return NextResponse.json({
        awarded: false,
      });
    }

    return NextResponse.json({
      awarded: true,
      wine: `${bestMatch.wineName} ${bestMatch.vintage}`.trim(),
      producer: bestMatch.producer,
      country: bestMatch.location || bestMatch.country,
      medal: bestMatch.medal,
      session: `${bestMatch.session} · ${bestMatch.year}`,
      feedbackUrl: bestMatch.resultUrl,
      productImageUrl: bestMatch.imageUrl,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
    });
  }
}