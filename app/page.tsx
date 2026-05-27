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
  const [scanResult, setScanResult] =
    useState<ScanResult>(null);

  const [visionResult, setVisionResult] =
    useState<VisionResult | null>(null);

  const [loading, setLoading] = useState(false);

  const [regions, setRegions] = useState<Region[]>([]);

  const [tab, setTab] =
    useState<'scanner' | 'restaurants'>('scanner');

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

  const resetScanner = () => {
    setPreview(null);
    setVisionResult(null);
    setScanResult(null);
  };

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

  const processImage = async (imageBase64: string) => {
    setLoading(true);

    setStatus('Analyzing label structure...');

    setPreview(imageBase64);

    setVisionResult(null);

    setScanResult(null);

    try {
      setStatus('Identifying producer and cuvée...');

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

      setStatus('Verifying official CMB recognition...');

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

  const handlePhoto = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const imageBase64 = await fileToBase64(file);

      await processImage(imageBase64);
    } catch (err) {
      console.error(err);

      setScanResult({
        awarded: false,
      });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#3d240c_0%,#090909_38%,#000000_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-[-10%] top-[10%] h-[340px] w-[340px] rounded-full bg-amber-400/10 blur-3xl" />

        <div className="absolute right-[-5%] top-[35%] h-[280px] w-[280px] rounded-full bg-yellow-200/5 blur-3xl" />
      </div>

      <div className="relative mx-auto min-h-screen max-w-md px-4 pb-16 pt-6">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark />

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-300 backdrop-blur">
            Global Recognition Platform
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 overflow-hidden rounded-[42px] border border-amber-300/10 bg-[linear-gradient(145deg,rgba(255,210,120,0.08),rgba(0,0,0,0.92))] p-7 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        >
          <div className="text-[11px] uppercase tracking-[0.35em] text-amber-300/70">
            Concours Mondial de Bruxelles
          </div>

          <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white">
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
              className="rounded-[38px] border border-amber-300/10 bg-white/[0.03] p-7 text-center shadow-[0_10px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <Camera className="mx-auto h-12 w-12 text-amber-300" />

              <h2 className="mt-4 text-2xl font-semibold">
                Scan wine label
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                Open the camera and align the wine label clearly
                inside the frame.
              </p>

              <label className="mt-7 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-amber-300 px-7 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-300/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,190,80,0.35)]">
                Open camera

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
                className="overflow-hidden rounded-[38px] border border-white/10 bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <img
                  src={preview}
                  alt="Captured label"
                  className="w-full object-contain"
                />
              </motion.div>
            )}

            <div className="rounded-[38px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <h2 className="text-2xl font-semibold">
                Result
              </h2>

              <p className="mt-2 text-sm text-stone-400">
                Official recognition verification
              </p>

              {loading && (
                <div className="mt-6 flex items-center gap-3 rounded-3xl border border-amber-300/15 bg-[linear-gradient(145deg,rgba(245,190,80,0.08),rgba(0,0,0,0.92))] p-5 text-sm text-amber-100 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-300" />

                  {status || 'Processing...'}
                </div>
              )}

              {!scanResult && !loading && (
                <div className="py-14 text-center text-stone-500">
                  Waiting wine scan...
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
                  className="relative mt-8 overflow-hidden rounded-[42px] border border-amber-300/20 bg-[linear-gradient(160deg,rgba(245,190,80,0.12),rgba(0,0,0,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.78)]"
                >
                  <div className="absolute left-[-15%] top-[10%] h-[260px] w-[260px] rounded-full bg-amber-300/10 blur-3xl" />

                  <div className="absolute right-[-10%] top-[20%] h-[220px] w-[220px] rounded-full bg-yellow-200/5 blur-3xl" />

                  <div className="relative z-10 px-7 pb-8 pt-7">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-200">
                          Official Verification
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-amber-300">
                          <ShieldCheck className="h-6 w-6" />

                          <div className="text-xl font-bold uppercase tracking-[0.06em]">
                            Awarded by CMB
                          </div>
                        </div>
                      </div>

                      <motion.div
                        animate={{
                          rotate: [0, 2, -2, 0],
                        }}
                        transition={{
                          duration: 5,
                          repeat: Infinity,
                        }}
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
                          className="h-28 w-28 object-contain drop-shadow-[0_0_40px_rgba(245,190,80,0.35)]"
                        />
                      </motion.div>
                    </div>

                    <div className="mt-10 flex items-center gap-5">
                      <motion.div
                        animate={{
                          y: [0, -6, 0],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="relative flex h-[320px] w-[135px] items-center justify-center"
                      >
                        <div className="absolute inset-0 rounded-[40px] bg-amber-300/10 blur-2xl" />

                        <img
                          src={
                            scanResult.productImageUrl ||
                            '/placeholders/wine-placeholder.png'
                          }
                          alt={scanResult.wine}
                          className="relative z-10 h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
                        />
                      </motion.div>

                      <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                          Wine
                        </div>

                        <div className="mt-2 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                          {scanResult.wine}
                        </div>

                        <div className="mt-7 space-y-5">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                              Medal
                            </div>

                            <div className="mt-1 text-sm font-medium text-amber-300">
                              {scanResult.medal}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                              Session
                            </div>

                            <div className="mt-1 text-sm leading-relaxed text-stone-200">
                              {scanResult.session}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                              Producer
                            </div>

                            <div className="mt-1 text-sm leading-relaxed text-stone-200">
                              {scanResult.producer}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                              Origin
                            </div>

                            <div className="mt-1 text-sm leading-relaxed text-stone-200">
                              {scanResult.country}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 bg-black/30 px-7 py-5 backdrop-blur-xl">
                    <a
                      href={scanResult.feedbackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-5 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-300/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,190,80,0.35)]"
                    >
                      Open Official CMB Result

                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>

                    <button
                      onClick={resetScanner}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
                    >
                      Scan another wine
                    </button>
                  </div>
                </motion.div>
              )}

              {scanResult?.awarded === false && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="mt-8 overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.03),rgba(0,0,0,0.92))] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
                >
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                    <XCircle className="h-9 w-9 text-stone-400" />
                  </div>

                  <div className="mt-6 text-2xl font-semibold text-white">
                    No official award found
                  </div>

                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-stone-400">
                    No official CMB recognition was found in the
                    current database for this wine.
                  </p>

                  <button
                    onClick={resetScanner}
                    className="mt-7 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
                  >
                    Scan another wine
                  </button>
                </motion.div>
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