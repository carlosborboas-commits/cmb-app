import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalize(value: string = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·•–—_\-\/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(reserve|reserva|estate|bottled|producer|cellars|vineyards|wine|vin|grand|selection|official|label|appellation|controlee|mis|bouteille)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string = '') {
  return normalize(value)
    .split(' ')
    .filter((t) => t.length >= 3);
}

function tokenOverlap(source: string, target: string) {
  const a = tokens(source);
  const b = tokens(target);

  if (!a.length || !b.length) return 0;

  const matches = a.filter((t) => b.includes(t)).length;

  return matches / a.length;
}

function hasToken(value: string, token: string) {
  return tokens(value).includes(normalize(token));
}

function year(value: any) {
  return Number(String(value || '').match(/\d{4}/)?.[0] || 0);
}

function sameVintage(a: string, b: string) {
  const aa = String(a || '').match(/\d{4}/)?.[0] || '';
  const bb = String(b || '').match(/\d{4}/)?.[0] || '';

  if (!aa || !bb) return true;

  return aa === bb;
}

function stylePenalty(search: string, candidate: string) {
  const s = normalize(search);
  const c = normalize(candidate);

  const groups = [
    {
      name: 'white',
      words: ['chardonnay', 'riesling', 'viognier', 'sauvignon', 'blanc', 'white'],
      conflicts: ['cabernet', 'merlot', 'syrah', 'malbec', 'marselan', 'red', 'rouge'],
    },
    {
      name: 'red',
      words: ['cabernet', 'merlot', 'syrah', 'malbec', 'marselan', 'red', 'rouge'],
      conflicts: ['chardonnay', 'riesling', 'viognier', 'sauvignon', 'blanc', 'white'],
    },
    {
      name: 'rose',
      words: ['rose', 'rosé'],
      conflicts: ['white', 'blanc', 'red', 'rouge', 'cabernet', 'chardonnay'],
    },
    {
      name: 'sparkling',
      words: ['brut', 'sparkling', 'spumante', 'sekt', 'champagne', 'cava'],
      conflicts: [],
    },
  ];

  let penalty = 0;

  for (const group of groups) {
    const searchHasGroup = group.words.some((w) => s.includes(w));
    const candidateHasConflict = group.conflicts.some((w) => c.includes(w));

    if (searchHasGroup && candidateHasConflict) {
      penalty += 0.35;
    }
  }

  return penalty;
}

function criticalTokenMissPenalty(searchWine: string, candidateWine: string) {
  const source = tokens(searchWine).filter((t) => t.length >= 5);
  const candidate = tokens(candidateWine);

  if (!source.length) return 0;

  const missed = source.filter((t) => !candidate.includes(t));

  return missed.length / source.length;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wineName = String(body.wineName || '');
    const producer = String(body.producer || '');
    const vintage = String(body.vintage || '');
    const detectedText = String(body.detectedText || '');

    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'cmb-results.json'
    );

    const raw = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(raw);

    const searchWine = wineName || detectedText;
    const searchAll = [wineName, producer, vintage, detectedText].join(' ');

    const scored = records
      .map((item: any) => {
        const candidateWine = `${item.wineName || ''} ${item.vintage || ''}`;
        const candidateAll = [
          item.wineName,
          item.producer,
          item.vintage,
          item.country,
          item.region,
          item.appellation,
          item.color,
          item.type,
          item.subType,
        ].join(' ');

        const wineScore = tokenOverlap(searchWine, candidateWine);
        const producerScore = producer
          ? tokenOverlap(producer, item.producer || '')
          : 0;
        const fullScore = tokenOverlap(searchAll, candidateAll);

        const vintageOk = sameVintage(vintage, item.vintage || '');
        const vintageExact =
          vintage && item.vintage && String(vintage) === String(item.vintage);

        let score =
          wineScore * 0.62 +
          producerScore * 0.23 +
          fullScore * 0.15;

        if (vintageExact) score += 0.22;
        if (vintage && !vintageOk) score -= 0.45;

        score -= stylePenalty(searchAll, candidateAll);

        const criticalPenalty = criticalTokenMissPenalty(
          searchWine,
          item.wineName || ''
        );

        score -= criticalPenalty * 0.45;

        const candidateYear = year(item.year);
        score += candidateYear * 0.00003;

        return {
          item,
          score,
          wineScore,
          producerScore,
          fullScore,
          vintageOk,
          candidateYear,
        };
      })
      .filter((entry: any) => {
        if (!entry.vintageOk) return false;

        // Regla anti-falsos positivos:
        // si el nombre del vino no coincide fuerte, NO validar.
        if (entry.wineScore < 0.62) return false;

        // Si hay productor leído, debe aportar algo o el nombre debe ser muy fuerte.
        if (producer && entry.producerScore < 0.18 && entry.wineScore < 0.82) {
          return false;
        }

        return entry.score >= 0.55;
      })
      .sort((a: any, b: any) => b.score - a.score);

    if (!scored.length) {
      return NextResponse.json({
        awarded: false,
        reason: 'low_confidence',
      });
    }

    let best = scored[0].item;

    // Si hay mismo vino/productor en años distintos, mostrar premio más reciente.
    const sameWineRecords = records
      .filter((r: any) => {
        const sameWine =
          normalize(r.wineName || '') === normalize(best.wineName || '');

        const sameProducer =
          normalize(r.producer || '') === normalize(best.producer || '');

        const vintageCompatible = sameVintage(vintage, r.vintage || '');

        return sameWine && sameProducer && vintageCompatible;
      })
      .sort((a: any, b: any) => year(b.year) - year(a.year));

    if (sameWineRecords.length) {
      best = sameWineRecords[0];
    }

    return NextResponse.json({
      awarded: true,
      wine: `${best.wineName || ''} ${best.vintage || ''}`.trim(),
      producer: best.producer,
      country: best.location || best.country,
      medal: best.medal,
      session: `${best.session} · ${best.year}`,
      feedbackUrl: best.resultUrl,
      productImageUrl: best.imageUrl,
      confidence: Math.min(1, Math.max(0, scored[0].score)),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      awarded: false,
      reason: 'server_error',
    });
  }
}