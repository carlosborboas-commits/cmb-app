'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import {
  ExternalLink,
  MapPin,
  ShieldCheck,
  XCircle,
  Loader2,
  Camera,
  X,
} from 'lucide-react';

function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-amber-400/20 bg-black p-2 shadow-2xl">
        <img src="/cmb-logo.png" alt="Concours Mondial de Bruxelles" className="h-16 w-16 object-contain" />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.32em] text-stone-400">Official</div>
        <div className="text-xl font-semibold tracking-[0.18em] text-white">CMB</div>
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

function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  const maxWidth = 1400;
  const scale = maxWidth / video.videoWidth;

  canvas.width = maxWidth;
  canvas.height = video.videoHeight * scale;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No canvas context');
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

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

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraOpen(true);
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      console.error(err);
      setCameraOpen(false);
      alert('Camera access was not available. Please allow camera permissions and try again.');
    }
  };

  const scanCMBResults = async (detectedText: string, displayName: string, visionData: VisionResult) => {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      setStatus('Identifying wine label...');

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

      setStatus('Searching CMB database...');

      await scanCMBResults(detectedText, displayName, visionData);
    } catch (err) {
      console.error(err);
      setScanResult({ awarded: false });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !cameraReady) return;

    try {
      const imageBase64 = captureVideoFrame(videoRef.current);
      stopCamera();
      await processImage(imageBase64);
    } catch (err) {
      console.error(err);
      stopCamera();
      setScanResult({ awarded: false });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#3d240c_0%,#090909_38%,#000000_100%)] text-white">
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_45%,rgba(0,0,0,0.72)_100%)]" />

          <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-5">
            <div className="rounded-full border border-amber-300/20 bg-black/45 px-4 py-2 text-[10px] uppercase tracking-[0.26em] text-amber-200 backdrop-blur-xl">
              CMB Live Scan
            </div>

            <button
              onClick={stopCamera}
              className="rounded-full border border-white/10 bg-black/45 p-3 text-white backdrop-blur-xl"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="absolute inset-0 flex items-center justify-center px-8">
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 rgba(245,190,80,0)',
                  '0 0 45px rgba(245,190,80,0.28)',
                  '0 0 0 rgba(245,190,80,0)',
                ],
              }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="relative h-[58vh] w-full max-w-sm rounded-[36px] border border-amber-300/55"
            >
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[36px] border-l-2 border-t-2 border-amber-300" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[36px] border-r-2 border-t-2 border-amber-300" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[36px] border-b-2 border-l-2 border-amber-300" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[36px] border-b-2 border-r-2 border-amber-300" />

              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-amber-200 backdrop-blur">
                Align wine label
              </div>
            </motion.div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 px-6">
            <div className="mb-5 text-center text-xs uppercase tracking-[0.24em] text-stone-300">
              {cameraReady ? 'Ready to verify official CMB recognition' : 'Starting camera...'}
            </div>

            <button
              onClick={captureAndScan}
              disabled={!cameraReady}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-5 py-5 text-sm font-semibold text-black shadow-[0_0_45px_rgba(245,190,80,0.3)] disabled:opacity-50"
            >
              Capture & Verify
            </button>
          </div>
        </div>
      )}

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
            Scan a wine label to instantly verify official awards and recognitions from the Concours Mondial de Bruxelles global database.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 rounded-3xl border border-white/10 bg-white/[0.035] p-1 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            onClick={() => setTab('scanner')}
            className={`rounded-2xl px-4 py-3 transition-all ${
              tab === 'scanner' ? 'bg-amber-300 text-black shadow-lg' : 'text-white hover:bg-white/5'
            }`}
          >
            Scan
          </button>

          <button
            onClick={() => setTab('restaurants')}
            className={`rounded-2xl px-4 py-3 transition-all ${
              tab === 'restaurants' ? 'bg-amber-300 text-black shadow-lg' : 'text-white hover:bg-white/5'
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

              <h2 className="mt-4 text-2xl font-semibold">Scan wine label</h2>

              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                Open the live camera and align the label inside the golden frame.
              </p>

              <label className="mt-7 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-amber-300 px-7 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-300/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,190,80,0.35)]">
  Open native camera

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
                <img src={preview} alt="Captured label" className="w-full object-contain" />
              </motion.div>
            )}

            <div className="rounded-[38px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <h2 className="text-2xl font-semibold">Result</h2>

              <p className="mt-2 text-sm text-stone-400">AI vision + CMB index matching</p>

              {loading && (
                <div className="mt-6 flex items-center gap-3 rounded-3xl border border-amber-300/15 bg-[linear-gradient(145deg,rgba(245,190,80,0.08),rgba(0,0,0,0.92))] p-5 text-sm text-amber-100 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                  {status || 'Processing...'}
                </div>
              )}

              {!scanResult && !loading && (
                <div className="py-14 text-center text-stone-500">Waiting label scan...</div>
              )}

              {scanResult?.awarded === true && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
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

                      <motion.div animate={{ rotate: [0, 2, -2, 0] }} transition={{ duration: 5, repeat: Infinity }}>
                        <img
                          src={`/medals/${
                            scanResult.medal.toLowerCase().includes('grand')
                              ? 'grand-gold'
                              : scanResult.medal.toLowerCase().includes('silver')
                              ? 'silver'
                              : 'gold'
                          }-${scanResult.session.match(/\d{4}/)?.[0] || '2024'}.png`}
                          alt="CMB Medal"
                          className="h-28 w-28 object-contain drop-shadow-[0_0_40px_rgba(245,190,80,0.35)]"
                        />
                      </motion.div>
                    </div>

                    <div className="mt-10 flex items-center gap-5">
                      <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative flex h-[320px] w-[135px] items-center justify-center"
                      >
                        <div className="absolute inset-0 rounded-[40px] bg-amber-300/10 blur-2xl" />

                        <img
                          src={scanResult.productImageUrl || '/placeholders/wine-placeholder.png'}
                          alt={scanResult.wine}
                          className="relative z-10 h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
                        />
                      </motion.div>

                      <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Wine</div>

                        <div className="mt-2 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                          {scanResult.wine}
                        </div>

                        <div className="mt-7 space-y-5">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Medal</div>
                            <div className="mt-1 text-sm font-medium text-amber-300">{scanResult.medal}</div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Session</div>
                            <div className="mt-1 text-sm leading-relaxed text-stone-200">{scanResult.session}</div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Producer</div>
                            <div className="mt-1 text-sm leading-relaxed text-stone-200">{scanResult.producer}</div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Origin</div>
                            <div className="mt-1 text-sm leading-relaxed text-stone-200">{scanResult.country}</div>
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
                  </div>
                </motion.div>
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
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
              >
                <h2 className="text-2xl font-semibold">{group.region}</h2>

                <div className="mt-4 grid gap-3">
                  {group.restaurants.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-all hover:border-amber-300/20 hover:bg-black/35"
                    >
                      <div className="font-semibold text-white">{r.name}</div>

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