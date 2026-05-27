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
      /\b(estate|bottled|producer|cellars|vineyards|wine|vin|official|label|appellation|controlee|mis|bouteille)\b/g,
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

function year(value: any) {
  return Number(String(value || '').match(/\d{4}/)?.[0] || 0);
}

function sameVintage(a: string, b: string) {
  const aa = String(a || '').match(/\d{4}/)?.[0] || '';
  const bb = String(b || '').match(/\d{4}/)?.[0] || '';
  if (!aa || !bb) return true;
  return aa === bb;
}

function hasAny(text: string, list: string[]) {
  const normalized = normalize(text);
  return list.some((item) => normalized.includes(normalize(item)));
}

function stylePenalty(search: string, candidate: string) {
  let penalty = 0;

  const groups = [
    {
      words: ['chardonnay', 'riesling', 'viognier', 'sauvignon', 'blanc', 'white'],
      conflicts: ['cabernet', 'merlot', 'syrah', 'malbec', 'marselan', 'red', 'rouge', 'roble', 'reserva'],
    },
    {
      words: ['cabernet', 'merlot', 'syrah', 'malbec', 'marselan', 'red', 'rouge'],
      conflicts: ['chardonnay', 'riesling', 'viognier', 'sauvignon', 'blanc', 'white'],
    },
    {
      words: ['rose', 'rosé'],
      conflicts: ['white', 'blanc', 'red', 'rouge', 'cabernet', 'chardonnay'],
    },
  ];

  for (const group of groups) {
    if (hasAny(search, group.words) && hasAny(candidate, group.conflicts)) {
      penalty += 0.35;
    }
  }

  return penalty;
}

function categoryConflictPenalty(searchWine: string, candidateWine: string) {
  let penalty = 0;

  const pairs = [
    ['reserva', 'roble'],
    ['grande reserva', 'roble'],
    ['gran reserva', 'roble'],
    ['brut', 'saten'],
    ['nature', 'extra brut'],
    ['white', 'red'],
    ['blanco', 'tinto'],
    ['branco', 'tinto'],
  ];

  for (const [searchTerm, conflictingTerm] of pairs) {
    if (
      normalize(searchWine).includes(normalize(searchTerm)) &&
      normalize(candidateWine).includes(normalize(conflictingTerm))
    ) {
      penalty += 0.55;
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

function isWeakNameMatch(searchWine: string, candidateWine: string) {
  const source = tokens(searchWine).filter((t) => t.length >= 4);
  const candidate = tokens(candidateWine);

  if (!source.length) return true;

  const matches = source.filter((t) => candidate.includes(t));

  // Si sólo comparte una palabra genérica, es demasiado débil.
  if (matches.length <= 1 && source.length >= 2) return true;

  return false;
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
          wineScore * 0.66 +
          producerScore * 0.2 +
          fullScore * 0.14;

        if (vintageExact) score += 0.28;
        if (vintage && !vintageOk) score -= 0.75;

        score -= stylePenalty(searchAll, candidateAll);
        score -= categoryConflictPenalty(searchWine, candidateWine);

        const criticalPenalty = criticalTokenMissPenalty(
          searchWine,
          item.wineName || ''
        );

        score -= criticalPenalty * 0.38;

        score += year(item.year) * 0.000025;

        return {
          item,
          score,
          wineScore,
          producerScore,
          fullScore,
          vintageOk,
          weakName: isWeakNameMatch(searchWine, candidateWine),
        };
      })
      .filter((entry: any) => {
        if (!entry.vintageOk) return false;

        // Evita falsos positivos tipo Reserva -> Roble.
        if (entry.weakName && entry.wineScore < 0.85) return false;

        // Si existe productor leído, debe ayudar salvo nombre exactísimo.
        if (producer && entry.producerScore < 0.16 && entry.wineScore < 0.86) {
          return false;
        }

        return entry.score >= 0.58;
      })
      .sort((a: any, b: any) => b.score - a.score);

    if (!scored.length) {
      return NextResponse.json({
        awarded: false,
        reason: 'low_confidence',
      });
    }

    let best = scored[0].item;

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