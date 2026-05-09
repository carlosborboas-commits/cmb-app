import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalize(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .filter((w) => w.length > 1);
}

function overlapScore(a: string, b: string) {
  const aa = tokens(a);
  const bb = tokens(b);

  if (aa.length === 0 || bb.length === 0) return 0;

  let matches = 0;

  for (const word of aa) {
    if (bb.includes(word)) matches++;
  }

  return matches / aa.length;
}

function yearNumber(value: any) {
  return Number(String(value || '').match(/\d{4}/)?.[0] || 0);
}

function sameVintage(a: string, b: string) {
  const aa = String(a || '').match(/\d{4}/)?.[0] || '';
  const bb = String(b || '').match(/\d{4}/)?.[0] || '';

  if (!aa || !bb) return true;

  return aa === bb;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = String(body.wineName || '').trim();
    const producer = String(body.producer || '').trim();
    const vintage = String(body.vintage || '').trim();
    const detectedText = String(body.detectedText || '').trim();

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(raw);

    const mainSearchName = wineName || detectedText.split('\n')[0] || '';

    const candidates = records
      .map((item: any) => {
        const wineScore = overlapScore(
          mainSearchName,
          `${item.wineName} ${item.vintage}`
        );

        const producerScore = producer
          ? overlapScore(producer, item.producer)
          : 0;

        const vintageMatch = sameVintage(vintage, item.vintage);

        const vintageBonus =
  vintage && String(item.vintage) === String(vintage) ? 0.25 : 0;

const vintagePenalty =
  vintage && String(item.vintage) !== String(vintage) ? -0.35 : 0;

const total =
  wineScore * 0.7 +
  producerScore * 0.1 +
  vintageBonus +
  vintagePenalty;

        return {
          item,
          score: total,
          wineScore,
          producerScore,
          vintageMatch,
          year: yearNumber(item.year),
        };
      })
      .filter((entry: any) => {
        if (vintage && !entry.vintageMatch) return false;

        // Regla crítica: no aceptar matches si el nombre del vino no coincide fuerte.
        if (entry.wineScore < 0.65) return false;

        return entry.score >= 0.55;
      });

    if (candidates.length === 0) {
      return NextResponse.json({
        awarded: false,
      });
    }

    candidates.sort((a: any, b: any) => {
      const scoreDifference = b.score - a.score;

      if (Math.abs(scoreDifference) > 0.05) {
        return scoreDifference;
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