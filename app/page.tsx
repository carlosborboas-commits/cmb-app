'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  MapPin,
  ShieldCheck,
  Crown,
  XCircle,
  Circle,
  Loader2,
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

function CameraReal({
  onCapture,
  loading,
}: {
  onCapture: (imageBase64: string) => void;
  loading: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error(err);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg');

    onCapture(imageBase64);
  };

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[32px] border border-amber-300/10 bg-black shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-56 w-40 rounded-xl border border-amber-300/40" />
      </div>

      <div className="absolute top-4 left-0 right-0 text-center text-xs uppercase tracking-[0.3em] text-stone-300">
        Align bottle label
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <button
          onClick={capture}
          disabled={loading}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-black"
        >
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          ) : (
            <Circle className="h-7 w-7 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

function ProductImage({
  url,
  wine,
}: {
  url: string | null;
  wine: string;
}) {
  if (!url) {
    return (
      <div className="flex h-72 w-full flex-col items-center justify-center gap-3 bg-black">
        <Crown className="h-10 w-10 text-amber-300" />

        <div className="text-sm uppercase tracking-[0.3em] text-stone-400">
          CMB Record
        </div>

        <div className="text-white">{wine}</div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={wine}
      className="h-72 w-full object-cover"
    />
  );
}

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
  | {
      awarded: false;
    }
  | null;

type Region = {
  region: string;
  restaurants: {
    name: string;
    city: string;
    country: string;
  }[];
};

export default function Page() {
  const [scanResult, setScanResult] = useState<ScanResult>(null);

  const [loading, setLoading] = useState(false);

  const [regions, setRegions] = useState<Region[]>([]);

  const [tab, setTab] = useState<'scanner' | 'restaurants'>('scanner');

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

  const handleCapture = async (imageBase64: string) => {
    setLoading(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
        }),
      });

      const data = await res.json();

      setScanResult(data);
    } catch (e) {
      console.error(e);

      setScanResult({
        awarded: false,
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
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
            Scan awarded wines instantly and explore the global network of CMB
            Experience Certified restaurants.
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            onClick={() => setTab('scanner')}
            className={`rounded-xl px-4 py-3 ${
              tab === 'scanner'
                ? 'bg-amber-300 text-black'
                : 'text-white'
            }`}
          >
            Camera Scan
          </button>

          <button
            onClick={() => setTab('restaurants')}
            className={`rounded-xl px-4 py-3 ${
              tab === 'restaurants'
                ? 'bg-amber-300 text-black'
                : 'text-white'
            }`}
          >
            Restaurants
          </button>
        </div>

        {tab === 'scanner' && (
          <div className="mt-6 space-y-6">
            <CameraReal
              onCapture={handleCapture}
              loading={loading}
            />

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold">Result</h2>

              <p className="mt-2 text-sm text-stone-400">
                Binary response from CMB database
              </p>

              {!scanResult && (
                <div className="py-14 text-center text-stone-500">
                  Waiting scan...
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

                  <a
                    href={scanResult.feedbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl bg-amber-300 px-5 py-3 text-sm font-medium text-black"
                  >
                    Open feedback
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </div>
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
              <div
                key={idx}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
              >
                <h2 className="text-2xl font-semibold">
                  {group.region}
                </h2>

                <div className="mt-4 grid gap-3">
                  {group.restaurants.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 p-4"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}