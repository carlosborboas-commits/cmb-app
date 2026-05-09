import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = path.join(process.cwd(), 'data', 'cmb-export.xlsx');
const outputPath = path.join(process.cwd(), 'public', 'data', 'cmb-results.json');

const SESSION_MAP = {
  ZAS: 'South Africa Selection by CMB',
  Sweet: 'Sesión CMB Vinos Dulces y Fortificados',
  Spark: 'Sesión CMB Vinos Espumosos',
  Sau: 'Sauvignon Selection by CMB',
  Rose: 'Sesión CMB Vinos Rosados',
  CMB: 'Sesión CMB Vinos Tintos y Blancos',
  Mars: 'Marselan Selection by CMB',
  LMX: 'México Selection by CMB',
  CMV: 'Vranec Selection by CMB',
  Bra: 'Brasil Selection by CMB',
};

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function mapSession(concours) {
  const value = clean(concours);
  return SESSION_MAP[value] || value || 'Concours Mondial de Bruxelles';
}

const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: '',
});

const records = rows
  .map((row) => {
    const country = clean(row.Pays);
    const region = clean(row.Region);
    const appellation = clean(row.Appellation);

    return {
      wineName: clean(row.Nom),
      producer: clean(row.DefaultContact),
      vintage: clean(row.Millesime),
      type: clean(row.Type),
      subType: clean(row.SousType),
      color: clean(row.Couleur),
      countryIso: clean(row.PaysISO),
      country,
      region: [region, appellation].filter(Boolean).join(' · '),
      appellation,
      medal: [clean(row.Award), clean(row.SpecialAward)].filter(Boolean).join(' · '),
      award: clean(row.Award),
      specialAward: clean(row.SpecialAward),
      year: clean(row.Concours).match(/\d{4}/)?.[0] || '',
      session: mapSession(clean(row.Concours).replace(/\d{4}/g, '').trim()),
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