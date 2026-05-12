'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import {
  ExternalLink,
  MapPin,
  ShieldCheck,
  XCircle,
  Loader2,
  Camera,
} from 'lucide-react';

function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-amber-400/20 bg-black p-2 shadow-2xl">
        <img
          src="/cmb-logo.png"
          alt="Concours Mondial de Bruxelles"
          className="h-16 w-16 object-contain"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.32em] text-stone-400">
          Official
        </div>

        <div className="text-xl font-semibold tracking-[0.18em] text-white">
          CMB
        </div>
      </div>
    </div>
  );
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

      resolve(canvas.toDataURL('image/jpeg', 0.92));
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

  const scanCMBResults = async (
    detectedText: string,
    displayName: string,
    visionData: VisionResult
  ) => {
    const res = await fetch('/api/scan', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        detectedText,
        image: detectedText,
        wineName: visionData.wineName,
        producer: visionData.producer,
        vintage: visionData.vintage,
      }),
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

  const handlePhoto = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          image: imageBase64,
        }),
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

      setStatus('Checking CMB index...');

      await scanCMBResults(
        detectedText,
        displayName,
        visionData
      );
    } catch (err) {
      console.error(err);

      setScanResult({
        awarded: false,
      });
    } finally {
      setLoading(false);

      setStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#2b1d0a_0%,#090909_38%,#000000_100%)] text-white">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark />

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-300 backdrop-blur">
            Global Recognition Platform
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 overflow-hidden rounded-[40px] border border-amber-300/10 bg-[linear-gradient(145deg,rgba(255,210,120,0.08),rgba(0,0,0,0.92))] p-7 shadow-[0_20px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        >
          <div className="text-[11px] uppercase tracking-[0.35em] text-amber-300/70">
            Concours Mondial de Bruxelles
          </div>

          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white">
            Global Wine Recognition Platform
          </h1>

          <p className="mt-5 max-w-[92%] text-sm leading-relaxed text-stone-300">
            Scan a wine label to instantly verify official awards and
            recognitions from the Concours Mondial de Bruxelles
            global database.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 rounded-3xl border border-white/10 bg-white/[0.035] p-1 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            onClick={() => setTab('scanner')}
            className={`rounded-2xl px-4 py-3 transition-all ${
              tab === 'scanner'
                ? 'bg-amber-300 text-black shadow-lg'
                : 'text-white hover:bg-white/5'
            }`}
          >
            Scan
          </button>

          <button
            onClick={() => setTab('restaurants')}
            className={`rounded-2xl px-4 py-3 transition-all ${
              tab === 'restaurants'
                ? 'bg-amber-300 text-black shadow-lg'
                : 'text-white hover:bg-white/5'
            }`}
          >
            CMB Experience
          </button>
        </div>

        {tab === 'scanner' && (
          <div className="mt-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-[36px] border border-amber-300/10 bg-white/[0.03] p-7 text-center shadow-[0_10px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <Camera className="mx-auto h-12 w-12 text-amber-300" />

              <h2 className="mt-4 text-2xl font-semibold">
                Scan wine label
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                Use the phone camera. Fill the frame with the wine
                name and keep the label as sharp as possible.
              </p>

              <label className="mt-7 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-amber-300 px-7 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-300/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,190,80,0.35)]">
                Scan with camera

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                />
              </label>
            </motion.div>

            {preview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45 }}
                className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <img
                  src={preview}
                  alt="Captured label"
                  className="w-full object-contain"
                />
              </motion.div>
            )}

            <div className="rounded-[36px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <h2 className="text-2xl font-semibold">
                Result
              </h2>

              <p className="mt-2 text-sm text-stone-400">
                AI vision + CMB index matching
              </p>

              {loading && (
                <div className="mt-6 flex items-center gap-3 rounded-3xl border border-amber-300/15 bg-[linear-gradient(145deg,rgba(245,190,80,0.08),rgba(0,0,0,0.92))] p-5 text-sm text-amber-100 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-300" />

                  {status || 'Processing...'}
                </div>
              )}

              {visionResult && (
                <details className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.24em] text-stone-400">
                    AI Vision Reading
                  </summary>

                  <div className="border-t border-white/10 p-4">
                    <div className="space-y-2 text-xs leading-relaxed text-stone-300">
                      <div>
                        <span className="text-stone-500">
                          Wine:
                        </span>{' '}
                        {visionResult.wineName ||
                          'Label text extracted'}
                      </div>

                      <div>
                        <span className="text-stone-500">
                          Producer:
                        </span>{' '}
                        {visionResult.producer ||
                          'Reading label'}
                      </div>

                      <div>
                        <span className="text-stone-500">
                          Vintage:
                        </span>{' '}
                        {visionResult.vintage ||
                          'Reading label'}
                      </div>

                      <div>
                        <span className="text-stone-500">
                          Region:
                        </span>{' '}
                        {scanResult?.awarded
                          ? scanResult.country
                          : visionResult.countryOrRegion ||
                            'Reading label'}
                      </div>

                      <div>
                        <span className="text-stone-500">
                          Confidence:
                        </span>{' '}
                        {visionResult.confidence
                          ? `${Math.round(
                              visionResult.confidence * 100
                            )}%`
                          : 'AI label reading active'}
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {!scanResult && !loading && (
                <div className="py-14 text-center text-stone-500">
                  Waiting label photo...
                </div>
              )}

              {scanResult?.awarded === true && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 30,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{
                    duration: 0.55,
                    ease: 'easeOut',
                  }}
                  className="mt-6 overflow-hidden rounded-[40px] border border-amber-300/25 bg-[radial-gradient(circle_at_top,rgba(245,190,80,0.18),rgba(0,0,0,0.96)_55%)] p-7 shadow-[0_24px_90px_rgba(0,0,0,0.75)]"
                >
                  <div className="text-center">
                    <div className="mx-auto mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200">
                      Verified Result
                    </div>

                    <div className="flex items-center justify-center gap-3 text-amber-300">
                      <ShieldCheck className="h-6 w-6" />

                      <div className="whitespace-nowrap text-xl font-bold uppercase tracking-[0.08em]">
                        Awarded by CMB
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 flex justify-center">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 30px rgba(245,190,80,0.12)',
                          '0 0 60px rgba(245,190,80,0.28)',
                          '0 0 30px rgba(245,190,80,0.12)',
                        ],
                      }}
                      transition={{
                        duration: 2.6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="rounded-full bg-amber-300/10 p-5"
                    >
                      <img
                        src={`/medals/${
                          scanResult.medal
                            .toLowerCase()
                            .includes('grand')
                            ? 'grand-gold'
                            : scanResult.medal
                                .toLowerCase()
                                .includes('silver')
                            ? 'silver'
                            : 'gold'
                        }-${
                          scanResult.session.match(
                            /\d{4}/
                          )?.[0] || '2024'
                        }.png`}
                        alt="CMB Medal"
                        className="h-44 w-44 object-contain drop-shadow-2xl"
                      />
                    </motion.div>
                  </div>

                  <div className="mt-7 text-center">
                    <div className="text-base font-medium leading-snug text-white">
                      {scanResult.wine}
                    </div>

                    <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-stone-500">
                      Official CMB Recognition
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 rounded-3xl border border-white/10 bg-black/45 p-5 text-sm backdrop-blur">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        Medal
                      </div>

                      <div className="mt-1 font-medium text-amber-300">
                        {scanResult.medal}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        Competition
                      </div>

                      <div className="mt-1 text-stone-200">
                        {scanResult.session}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        Region
                      </div>

                      <div className="mt-1 text-stone-200">
                        {scanResult.country}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        Producer
                      </div>

                      <div className="mt-1 text-stone-200">
                        {scanResult.producer}
                      </div>
                    </div>
                  </div>

                  <a
                    href={scanResult.feedbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-5 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-300/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,190,80,0.35)]"
                  >
                    Open CMB result

                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </motion.div>
              )}

              {scanResult?.awarded === false && (
                <div className="py-10 text-center">
                  <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />

                  <div className="text-xl text-white">
                    Not awarded
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'restaurants' && (
          <div className="mt-6 space-y-4">
            {regions.map((group, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
              >
                <h2 className="text-2xl font-semibold">
                  {group.region}
                </h2>

                <div className="mt-4 grid gap-3">
                  {group.restaurants.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-all hover:border-amber-300/20 hover:bg-black/35"
                    >
                      <div className="font-semibold text-white">
                        {r.name}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
                        <MapPin className="h-4 w-4 text-amber-300" />

                        {r.city}, {r.country}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}