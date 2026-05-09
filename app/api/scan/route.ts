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

function words(value: string) {
  return normalize(value).split(' ').filter(Boolean);
}

function similarity(a: string, b: string) {
  const aa = words(a);
  const bb = words(b);

  let score = 0;

  for (const word of aa) {
    if (bb.includes(word)) score++;
  }

  return score / Math.max(aa.length, 1);
}

function yearNumber(value: any) {
  return Number(String(value || '').match(/\d{4}/)?.[0] || 0);
}

function sameVintage(a: string, b: string) {
  const aa = String(a || '').match(/\d{4}/)?.[0] || '';
  const bb = String(b || '').match(/\d{4}/)?.[0] || '';
  return aa && bb && aa === bb;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = body.wineName || '';
    const producer = body.producer || '';
    const vintage = body.vintage || '';
    const detectedText = body.detectedText || '';

    const searchText = [wineName, producer, vintage, detectedText].join(' ');

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(raw);

    const candidates = records
      .map((item: any) => {
        const wineScore = similarity(
          `${wineName} ${vintage}`,
          `${item.wineName} ${item.vintage}`
        );

        const producerScore = similarity(producer, item.producer);

        const textScore = similarity(
          searchText,
          `${item.wineName} ${item.producer} ${item.vintage}`
        );

        const total = wineScore * 0.55 + producerScore * 0.25 + textScore * 0.2;

        const vintageMatch = vintage
          ? sameVintage(vintage, item.vintage)
          : true;

        return {
          item,
          score: total,
          year: yearNumber(item.year),
          vintageMatch,
        };
      })
      .filter((entry: any) => entry.score >= 0.45 && entry.vintageMatch);

    if (candidates.length === 0) {
      return NextResponse.json({
        awarded: false,
      });
    }

    candidates.sort((a: any, b: any) => {
      if (b.score !== a.score) {
        const scoreDifference = b.score - a.score;

        if (Math.abs(scoreDifference) > 0.08) {
          return scoreDifference;
        }
      }

      return b.year - a.year;
    });

    const bestMatch = candidates[0].item;

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