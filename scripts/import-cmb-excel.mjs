import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = path.join(process.cwd(), 'data', 'cmb-export.xlsx');
const outputPath = path.join(process.cwd(), 'public', 'data', 'cmb-results.json');

const SESSION_MAP = {
  ZAS: 'South Africa Selection by CMB',
  SWEET: 'CMB Sweet and Fortified Wines Session',
  SPARK: 'CMB Sparkling Wines Session',
  SAU: 'Sauvignon Selection by CMB',
  ROSE: 'CMB Rosé Wines Session',
  CMB: 'CMB Red and White Wines Session',
  MARS: 'Marselan Selection by CMB',
  LMX: 'México Selection by CMB',
  CMV: 'Vranec Selection by CMB',
  BRA: 'Brasil Selection by CMB',
};

const ISO_COUNTRY_MAP = {
  US: 'United States',
  USA: 'United States',
  MX: 'Mexico',
  ES: 'Spain',
  FR: 'France',
  IT: 'Italy',
  DE: 'Germany',
  CN: 'China',
  ZA: 'South Africa',
  BR: 'Brazil',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  PT: 'Portugal',
  AR: 'Argentina',
  CL: 'Chile',
  UY: 'Uruguay',
  AU: 'Australia',
  NZ: 'New Zealand',
  CA: 'Canada',
  BE: 'Belgium',
  NL: 'Netherlands',
  GR: 'Greece',
  RO: 'Romania',
  BG: 'Bulgaria',
  MD: 'Moldova',
  GE: 'Georgia',
  AM: 'Armenia',
  LB: 'Lebanon',
  TR: 'Turkey',
};

const COUNTRY_NAME_MAP = {
  'Etats-Unis': 'United States',
  'États-Unis': 'United States',
  USA: 'United States',
  México: 'Mexico',
  Mexique: 'Mexico',
  Espagne: 'Spain',
  España: 'Spain',
  France: 'France',
  Italie: 'Italy',
  Italia: 'Italy',
  Allemagne: 'Germany',
  Deutschland: 'Germany',
  Chine: 'China',
  Afrique_du_Sud: 'South Africa',
  'Afrique du Sud': 'South Africa',
  Brésil: 'Brazil',
  Brasil: 'Brazil',
  Royaume_Uni: 'United Kingdom',
  RoyaumeUni: 'United Kingdom',
  Belgique: 'Belgium',
};

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function getYear(concours) {
  return clean(concours).match(/\d{4}/)?.[0] || '';
}

function getSession(concours) {
  const value = clean(concours);
  const code = value.replace(/\d{4}/g, '').trim();
  return SESSION_MAP[code] || code || 'Concours Mondial de Bruxelles';
}

function translateCountry(country, iso) {
  const code = clean(iso).toUpperCase();
  const name = clean(country);

  if (ISO_COUNTRY_MAP[code]) {
    return ISO_COUNTRY_MAP[code];
  }

  return COUNTRY_NAME_MAP[name] || name;
}

function translateAward(value) {
  const award = clean(value).toLowerCase();

  if (!award) return '';

  if (award.includes('grand') || award.includes('gran')) {
    return 'Grand Gold Medal';
  }

  if (award.includes('gold') || award.includes('oro')) {
    return 'Gold Medal';
  }

  if (award.includes('silver') || award.includes('plata')) {
    return 'Silver Medal';
  }

  if (award.includes('merit')) {
    return 'CMB Merit';
  }

  return clean(value);
}

const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];

const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: '',
});

const records = rows
  .map((row) => {
    const country = translateCountry(row.Pays, row.PaysISO);
    const region = clean(row.Region);
    const appellation = clean(row.Appellation);

    const location = [country, region, appellation]
      .filter(Boolean)
      .join(' · ');

    const award = translateAward(row.Award);
    const specialAward = clean(row.SpecialAward);

    return {
      wineName: clean(row.Nom),
      producer: clean(row.DefaultContact),
      vintage: clean(row.Millesime),
      type: clean(row.Type),
      subType: clean(row.SousType),
      color: clean(row.Couleur),
      countryIso: clean(row.PaysISO),

      country,
      region,
      appellation,
      location,

      medal: [award, specialAward].filter(Boolean).join(' · '),
      award,
      specialAward,

      year: getYear(row.Concours),
      session: getSession(row.Concours),
      concours: clean(row.Concours),

      resultUrl: clean(row.WineSpaceLink),
      imageUrl: clean(row.PrizeListImageUrl),
    };
  })
  .filter((item) => item.wineName && item.medal);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf8');

console.log(`DONE: ${records.length} CMB records imported`);
console.log(`Output: ${outputPath}`);