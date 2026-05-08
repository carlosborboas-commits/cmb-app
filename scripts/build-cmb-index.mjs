import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];
const BASE = 'https://results.concoursmondial.com';

function clean(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function extractVintage(name = '') {
  return name.match(/\b(19|20)\d{2}\b/)?.[0] || '';
}

function parseInfo(info = '') {
  const medalMatch = info.match(/(Gran Medalla de Oro|Medalla de oro|Medalla de Plata|CMB Merit)/i);
  const medal = medalMatch ? medalMatch[1] : 'Premio CMB';

  const beforeMedal = medalMatch ? info.slice(0, medalMatch.index).trim() : info;
  const parts = beforeMedal.split(/\s{2,}| - /).map(clean).filter(Boolean);

  return {
    producer: parts[0] || '',
    country: parts[1] || '',
    region: parts.slice(2).join(' · ') || '',
    medal,
  };
}

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${res.status}: ${url}`);
  return res.text();
}

async function run() {
  const records = [];

  for (const year of YEARS) {
    console.log(`\nYEAR ${year}`);

    for (let page = 1; page <= 60; page++) {
      const url = `${BASE}/es/resultados/${year}?page=${page}`;
      console.log(`PAGE ${page}`);

      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      let countOnPage = 0;

      $('h3').each((_, h3) => {
        const wineName = clean($(h3).text());
        if (!wineName) return;

        const cardText = clean(
          $(h3)
            .parent()
            .text()
        );

        const infoText = clean(cardText.replace(wineName, ''));

        const link =
          $(h3).closest('a').attr('href') ||
          $(h3).parent().find('a[href*="/es/resultados/"]').first().attr('href') ||
          $(h3).prevAll('a[href*="/es/resultados/"]').first().attr('href') ||
          '';

        const fullUrl = link
          ? link.startsWith('http')
            ? link
            : `${BASE}${link}`
          : url;

        const parsed = parseInfo(infoText);

        records.push({
          wineName,
          producer: parsed.producer,
          vintage: extractVintage(wineName),
          country: parsed.country,
          region: parsed.region,
          medal: parsed.medal,
          year,
          session: 'Concours Mondial de Bruxelles',
          resultUrl: fullUrl,
          imageUrl: '',
        });

        countOnPage++;
      });

      console.log(`FOUND ${countOnPage}`);

      if (countOnPage === 0) break;
    }
  }

  const seen = new Set();
  const unique = records.filter((item) => {
    const key = `${item.year}-${item.wineName}-${item.producer}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const outPath = path.join(process.cwd(), 'public', 'data', 'cmb-results.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf8');

  console.log(`\nDONE: ${unique.length} wines indexed`);
}

run();