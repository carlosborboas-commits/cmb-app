import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      region: 'Europa',
      restaurants: [
        { name: 'Maison des Accords', city: 'Bruselas', country: 'Bélgica' },
        { name: 'Terroir Table', city: 'Lisboa', country: 'Portugal' },
      ],
    },
    {
      region: 'América del Norte',
      restaurants: [
        { name: 'Wine Bar by CMB', city: 'Ciudad de México', country: 'México' },
        { name: 'Cellar Route', city: 'Nueva York', country: 'Estados Unidos' },
      ],
    },
  ]);
}