// src/hooks/useFriendPlayback.ts
// v2.0 – Smooth playback with dead-reckoning extrapolation
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Friend, Breadcrumb } from './useSocial';

export interface InterpolatedState {
  lat: number;
  lon: number;
  heading: number;
  speed: number; // m/s
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Short delay so we always have a little buffer for interpolation even with network jitter.
const PLAYBACK_DELAY_MS = 2000;
// How far ahead of the last known point we'll dead-reckon before freezing the marker.
const MAX_DEAD_RECKON_MS = 30000;
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Interpolate a heading angle across the 0/360 boundary. */
function lerpHeading(h1: number, h2: number, t: number): number {
  const diff = ((h2 - h1 + 540) % 360) - 180;
  return (h1 + diff * t + 360) % 360;
}

/**
 * Dead-reckoning: given a position, heading (°N clockwise) and speed (m/s),
 * project forward by `dMs` milliseconds using spherical Earth approximation.
 */
function deadReckon(
  lat: number,
  lon: number,
  headingDeg: number,
  speedMs: number,
  dMs: number
): { lat: number; lon: number } {
  const distM = speedMs * (dMs / 1000);
  if (distM < 0.01) return { lat, lon }; // not moving

  const headingRad = headingDeg * DEG_TO_RAD;
  const dLatRad = (distM * Math.cos(headingRad)) / EARTH_RADIUS_M;
  const dLonRad =
    (distM * Math.sin(headingRad)) /
    (EARTH_RADIUS_M * Math.cos(lat * DEG_TO_RAD));

  return {
    lat: lat + dLatRad / DEG_TO_RAD,
    lon: lon + dLonRad / DEG_TO_RAD,
  };
}

/**
 * Derive the effective heading and speed from the last two breadcrumbs.
 * Falls back to the embedded h/s fields in the last point.
 */
function deriveVelocity(
  batch: Breadcrumb[]
): { headingDeg: number; speedMs: number } {
  const last = batch[batch.length - 1];

  if (batch.length >= 2) {
    const prev = batch[batch.length - 2];
    const dtSec = (last.t - prev.t) / 1000;

    if (dtSec > 0 && dtSec < 60) {
      const dLat = last.lat - prev.lat;
      const dLon = last.lon - prev.lon;

      // Approximate distance in metres
      const dLatM = dLat * DEG_TO_RAD * EARTH_RADIUS_M;
      const dLonM =
        dLon * DEG_TO_RAD * EARTH_RADIUS_M * Math.cos(last.lat * DEG_TO_RAD);
      const distM = Math.sqrt(dLatM ** 2 + dLonM ** 2);
      const speedMs = distM / dtSec;

      if (speedMs > 0.5) {
        // Moving (> ~1.8 km/h) – derive heading from displacement
        const headingDeg =
          ((Math.atan2(dLonM, dLatM) / DEG_TO_RAD) + 360) % 360;
        return { headingDeg, speedMs };
      }
    }
  }

  // Fallback to embedded fields
  return {
    headingDeg: last.h ?? 0,
    speedMs: last.s ?? 0,
  };
}

/**
 * Return the interpolated (or extrapolated) state for `targetTime`.
 * Never returns null when batch has at least one point.
 */
function getStateAtTime(
  batch: Breadcrumb[],
  targetTime: number
): InterpolatedState {
  // Clamp to first point if target is before buffer start
  if (targetTime <= batch[0].t) {
    return {
      lat: batch[0].lat,
      lon: batch[0].lon,
      heading: batch[0].h ?? 0,
      speed: batch[0].s ?? 0,
    };
  }

  // Scan for the two bracketing points
  for (let i = 0; i < batch.length - 1; i++) {
    const p1 = batch[i];
    const p2 = batch[i + 1];
    if (p1.t <= targetTime && p2.t > targetTime) {
      const f = (targetTime - p1.t) / (p2.t - p1.t);
      return {
        lat: p1.lat + (p2.lat - p1.lat) * f,
        lon: p1.lon + (p2.lon - p1.lon) * f,
        heading: lerpHeading(p1.h ?? 0, p2.h ?? 0, f),
        speed: (p1.s ?? 0) + ((p2.s ?? 0) - (p1.s ?? 0)) * f,
      };
    }
  }

  // targetTime is BEYOND the last known point – dead reckon forward
  const last = batch[batch.length - 1];
  const overshot = targetTime - last.t;

  if (overshot > MAX_DEAD_RECKON_MS) {
    // Too far ahead – friend probably stopped or app closed
    return { lat: last.lat, lon: last.lon, heading: last.h ?? 0, speed: 0 };
  }

  const { headingDeg, speedMs } = deriveVelocity(batch);
  const projected = deadReckon(last.lat, last.lon, headingDeg, speedMs, overshot);

  return {
    lat: projected.lat,
    lon: projected.lon,
    heading: headingDeg,
    speed: speedMs,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFriendPlayback(
  friends: Friend[],
  friendBatches: Record<string, Breadcrumb[]>
) {
  const [interpolatedPositions, setInterpolatedPositions] =
    useState<Record<string, InterpolatedState>>({});

  // Keep refs in sync so the animation loop never needs to restart
  const friendsRef = useRef(friends);
  const batchesRef = useRef(friendBatches);
  useEffect(() => { friendsRef.current = friends; }, [friends]);
  useEffect(() => { batchesRef.current = friendBatches; }, [friendBatches]);

  // Debug counters
  const frameRef = useRef(0);

  // Start the RAF loop ONCE on mount – it runs forever
  useEffect(() => {
    let rafId: number;

    const loop = () => {
      const now = Date.now();
      const targetTime = now - PLAYBACK_DELAY_MS;

      frameRef.current++;
      const shouldLog = frameRef.current % 120 === 0; // log ~every 2s

      const nextPositions: Record<string, InterpolatedState> = {};

      friendsRef.current.forEach((friend) => {
        const batch = batchesRef.current[friend.id];

        if (batch && batch.length > 0) {
          nextPositions[friend.id] = getStateAtTime(batch, targetTime);

          if (shouldLog) {
            const s = nextPositions[friend.id];
            const overshoot = targetTime - batch[batch.length - 1].t;
            console.log(
              `[Playback] ${friend.car_name} | pts=${batch.length}` +
              ` | overshoot=${(overshoot / 1000).toFixed(1)}s` +
              ` | lat=${s.lat.toFixed(6)} lon=${s.lon.toFixed(6)}` +
              ` | hdg=${s.heading.toFixed(1)}° spd=${(s.speed * 3.6).toFixed(1)}km/h`
            );
          }
        } else if (friend.last_lat && friend.last_lon) {
          // No live batch yet – fall back to last DB position (static)
          nextPositions[friend.id] = {
            lat: friend.last_lat,
            lon: friend.last_lon,
            heading: 0,
            speed: 0,
          };
        }
      });

      setInterpolatedPositions(nextPositions);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // ← empty deps: loop is stable forever

  return interpolatedPositions;
}
