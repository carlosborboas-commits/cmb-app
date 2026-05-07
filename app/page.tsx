'use client';

import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  MapPin,
  ShieldCheck,
  Crown,
  XCircle,
  Loader2,
  Camera,
} from 'lucide-react';

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-white/5">
        <Crown className="h-6 w-6 text-amber-300" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.32em] text-stone-400">
          Official
        </div>
        <div className="text-sm font-medium tracking-[0.14em] text-white">
          CMB
        </div>
      </div>
    </div>
  );
}

function ProductImage({ url, wine }: { url: string | null; wine: string }) {
  if (!url) {
    return (
      <div className="flex h-72 w-full flex-col items-center justify-center gap-3 bg-black">
        <Crown className="h-10 w-10 text-amber-300" />
        <div className="text-sm uppercase tracking-[0.3em] text-stone-400">
          CMB Record
        </div>
        <div className="px-6 text-center text-white">{wine}</div>
      </div>
    );
  }

  return <img src={url} alt={wine} className="h-72 w-full object-contain" />;
}

type VisionResult = {
  wineName: string;
  producer: string;
  vintage: string;
  countryOrRegion: string;
  confidence: number;
  rawText: string;
};

type ScanResult =
  | {
      awarded: true;
      wine: string;
      producer: string;
      country: string;
      medal: string;
      session: string;
      feedbackUrl: string;
      productImageUrl: string | null;
    }
  | { awarded: false }
  | null;

type Region = {
  region: string;
  restaurants: {
    name: string;
    city: string;
    country: string;
  }[];
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 1400;
      const scale = maxWidth / img.width;

      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject('No canvas context');
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const jpeg = canvas.toDataURL('image/jpeg', 0.92);

      resolve(jpeg);
    };

    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [tab, setTab] = useState<'scanner' | 'restaurants'>('scanner');
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function loadRestaurants() {
      try {
        const res = await fetch('/api/restaurants');
        const data = await res.json();
        setRegions(data);
      } catch (e) {
        console.error(e);
      }
    }

    loadRestaurants();
  }, []);

  const scanCMBResults = async (detectedText: string, displayName: string) => {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detectedText, image: detectedText }),
    });

    const data = await res.json();

    if (data.awarded) {
      setScanResult({
        ...data,
        wine: data.wine || displayName || 'CMB Awarded Wine',
      });
    } else {
      setScanResult(data);
    }
  };

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setLoading(true);
    setStatus('Preparing image...');
    setPreview(null);
    setVisionResult(null);
    setScanResult(null);

    try {
      const imageBase64 = await fileToBase64(file);

      setPreview(imageBase64);
      setStatus('Reading label with AI vision...');

      const visionResponse = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      const visionData = await visionResponse.json();

      setVisionResult(visionData);

      const displayName =
        visionData.wineName ||
        visionData.producer ||
        visionData.rawText?.split(' ').slice(0, 6).join(' ') ||
        'CMB Awarded Wine';

      const detectedText = [
        visionData.wineName,
        visionData.producer,
        visionData.vintage,
        visionData.countryOrRegion,
        visionData.rawText,
      ]
        .filter(Boolean)
        .join(' ');

      setStatus('Checking CMB public results...');

      await scanCMBResults(detectedText, displayName);
    } catch (err) {
      console.error(err);
      setScanResult({ awarded: false });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 to-black text-white">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <BrandMark />

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-300">
            Official Prototype
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-[32px] border border-amber-300/10 bg-gradient-to-br from-amber-300/10 via-black to-black p-6 shadow-2xl">
          <div className="text-[11px] uppercase tracking-[0.35em] text-amber-300/70">
            Concours Mondial de Bruxelles
          </div>

          <h1 className="mt-3 text-3xl font-semibold leading-tight text-white">
            Global Wine Recognition Platform
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            Take a high-resolution photo of a wine label. AI vision will extract
            the wine name and check it against CMB public results.
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            onClick={() => setTab('scanner')}
            className={`rounded-xl px-4 py-3 ${
              tab === 'scanner' ? 'bg-amber-300 text-black' : 'text-white'
            }`}
          >
            Label Photo
          </button>

          <button
            onClick={() => setTab('restaurants')}
            className={`rounded-xl px-4 py-3 ${
              tab === 'restaurants' ? 'bg-amber-300 text-black' : 'text-white'
            }`}
          >
            Restaurants
          </button>
        </div>

        {tab === 'scanner' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-[32px] border border-amber-300/10 bg-white/[0.04] p-6 text-center">
              <Camera className="mx-auto h-12 w-12 text-amber-300" />

              <h2 className="mt-4 text-2xl font-semibold">
                Take label photo
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                Use the phone camera. Fill the frame with the wine name and keep
                the label as sharp as possible.
              </p>

              <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-medium text-black">
                Open camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                />
              </label>
            </div>

            {preview && (
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04]">
                <img src={preview} alt="Captured label" className="w-full object-cover" />
              </div>
            )}

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold">Result</h2>

              <p className="mt-2 text-sm text-stone-400">
                AI vision + CMB public results matching
              </p>

              {loading && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-black p-4 text-sm text-amber-200">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {status || 'Processing...'}
                </div>
              )}

              {visionResult && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300">
                    AI Vision Reading
                  </div>

                  <div className="mt-3 space-y-2 text-xs leading-relaxed text-stone-300">
                    <div>
                      <span className="text-stone-500">Wine:</span>{' '}
                      {visionResult.wineName ||
                        visionResult.rawText?.split(' ').slice(0, 6).join(' ') ||
                        'Label text extracted'}
                    </div>

                    <div>
                      <span className="text-stone-500">Producer:</span>{' '}
                      {visionResult.producer || 'Read from label text'}
                    </div>

                    <div>
                      <span className="text-stone-500">Vintage:</span>{' '}
                      {visionResult.vintage || 'Detected in raw text'}
                    </div>

                    <div>
                      <span className="text-stone-500">Region:</span>{' '}
                      {visionResult.countryOrRegion || 'Detected from label'}
                    </div>

                    <div>
                      <span className="text-stone-500">Confidence:</span>{' '}
                      {visionResult.confidence
                        ? `${Math.round(visionResult.confidence * 100)}%`
                        : 'AI label reading active'}
                    </div>

                    <div className="pt-2">
                      <span className="text-stone-500">Raw text:</span>
                      <div className="mt-1 whitespace-pre-wrap">
                        {visionResult.rawText || 'No text detected'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!scanResult && !loading && (
                <div className="py-14 text-center text-stone-500">
                  Waiting label photo...
                </div>
              )}

              {scanResult?.awarded === true && (
                <div className="mt-6 space-y-4">
                  <div className="overflow-hidden rounded-[28px] border border-amber-400/20">
                    <ProductImage
                      url={scanResult.productImageUrl}
                      wine={scanResult.wine}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-amber-300">
                    <ShieldCheck className="h-5 w-5" />
                    Awarded by CMB
                  </div>

                  <div className="text-2xl font-semibold text-white">
                    {scanResult.wine}
                  </div>
<div className="rounded-2xl border border-amber-300/20 bg-black p-4 text-sm">
  <div className="text-amber-300">
<img
  src={`/medals/${
    scanResult.medal.toLowerCase().includes('gran')
      ? 'grand-gold'
      : scanResult.medal.toLowerCase().includes('plata')
      ? 'silver'
      : 'gold'
  }-${
    scanResult.session.match(/\d{4}/)?.[0] || '2024'
  }.png`}
  alt="CMB Medal"
  className="h-36 w-36 object-contain"
/>
    {scanResult.medal}
  </div>

  <div className="mt-1 text-stone-400">
    {scanResult.session}
  </div>
</div>
                  <a
                    href={scanResult.feedbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl bg-amber-300 px-5 py-3 text-sm font-medium text-black"
                  >
                    Open CMB result
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </div>
              )}

              {scanResult?.awarded === false && (
                <div className="py-10 text-center">
                  <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
                  <div className="text-xl text-white">Not awarded</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'restaurants' && (
          <div className="mt-6 space-y-4">
            {regions.map((group, idx) => (
              <div
                key={idx}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
              >
                <h2 className="text-2xl font-semibold">{group.region}</h2>

                <div className="mt-4 grid gap-3">
                  {group.restaurants.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 p-4">
                      <div className="font-semibold text-white">{r.name}</div>

                      <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
                        <MapPin className="h-4 w-4 text-amber-300" />
                        {r.city}, {r.country}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}