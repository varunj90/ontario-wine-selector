import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";

type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
  state: string;
};

type StoreRow = {
  id: string;
  lcboStoreCode: string | null;
  displayName: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type RankedStore = {
  id: string;
  label: string;
  city: string | null;
  distanceKm: number;
};

function normalizePostalCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

async function geocodePostalPrefix(postalPrefix: string): Promise<GeocodeResult | null> {
  const response = await fetch(`https://api.zippopotam.us/ca/${postalPrefix}`, {
    method: "GET",
    headers: { "user-agent": "ontario-wine-selector/1.0" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    places?: Array<{
      latitude?: string;
      longitude?: string;
      "place name"?: string;
      state?: string;
    }>;
  };

  const place = data.places?.[0];
  if (!place?.latitude || !place.longitude) return null;

  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    placeName: place["place name"] ?? "Unknown",
    state: place.state ?? "Unknown",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalPrefix = normalizePostalCode(searchParams.get("postalCode") ?? "");
  const limit = Math.min(12, Math.max(3, Number(searchParams.get("limit") ?? "6")));

  if (!postalPrefix) {
    return NextResponse.json({
      postalCode: "",
      stores: [],
      note: "Enter a postal prefix (e.g., M5V) to find nearby LCBO stores.",
    });
  }

  const geocode = await geocodePostalPrefix(postalPrefix);
  if (!geocode) {
    return NextResponse.json(
      {
        postalCode: postalPrefix,
        stores: [],
        note: "Could not geocode that postal prefix. Try another Ontario prefix.",
      },
      { status: 400 },
    );
  }

  const stores = await prisma.store.findMany({
    where: {
      isActive: true,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      lcboStoreCode: true,
      displayName: true,
      city: true,
      latitude: true,
      longitude: true,
    },
    take: 3000,
  });

  const rankedStores = stores
    .map((store: StoreRow): RankedStore => {
      const distance = distanceKm(geocode.latitude, geocode.longitude, store.latitude ?? 0, store.longitude ?? 0);
      return {
        id: store.lcboStoreCode ?? store.id,
        label: store.displayName,
        city: store.city,
        distanceKm: Number(distance.toFixed(1)),
      };
    })
    .sort((a: RankedStore, b: RankedStore) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return NextResponse.json({
    postalCode: postalPrefix,
    geocode,
    stores: rankedStores,
  });
}

