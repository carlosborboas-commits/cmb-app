import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body?.image;

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: 'gpt-4.1',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
You are analyzing a photograph of a wine bottle label.

Your job is NOT to be overly cautious.
Extract the most likely wine information visible on the label.

Return ONLY valid JSON. No markdown. No explanation.

JSON structure:
{
  "wineName": "",
  "producer": "",
  "vintage": "",
  "countryOrRegion": "",
  "confidence": 0,
  "rawText": ""
}

Instructions:
- wineName: the largest or most distinctive wine name, cuvée name, vineyard name, or label name.
- producer: winery, château, domaine, bodega, maison, estate, or brand.
- vintage: year if visible.
- countryOrRegion: appellation, region, country, valley, DO, DOC, AOC, AVA if visible.
- rawText: transcribe all readable label text, even partial.
- If uncertain, make the best possible guess from visible text.
- confidence should reflect certainty from 0 to 1.
- Do not return "not detected" unless the image contains no readable label text at all.
              `,
            },
            {
              type: 'input_image',
              image_url: image,
              detail: 'high',
            },
          ],
        },
      ],
    });

    const text = response.output_text;

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: text,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        wineName: '',
        producer: '',
        vintage: '',
        countryOrRegion: '',
        confidence: 0,
        rawText: '',
        error: 'Vision analysis failed',
      },
      { status: 500 }
    );
  }
}