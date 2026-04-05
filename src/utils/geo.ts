// src/utils/geo.ts

// Distancia entre dos puntos [lat, lon] en metros (Haversine simple)
export function getDistance(p1: [number, number], p2: [number, number]) {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function findClosestPointIndex(pos: [number, number], points: [number, number][]) {
  let minIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = getDistance(pos, points[i]);
    if (d < minDistance) {
      minDistance = d;
      minIndex = i;
    }
  }
  return minIndex;
}

// Distancia de un punto a un segmento definido por dos puntos
export function distanceToSegment(p: [number, number], v: [number, number], w: [number, number]) {
  const l2 = Math.pow(v[0] - w[0], 2) + Math.pow(v[1] - w[1], 2);
  if (l2 === 0) return getDistance(p, v);
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection: [number, number] = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return getDistance(p, projection);
}

export function distanceToPolyline(p: [number, number], polyline: [number, number][]) {
  let minD = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegment(p, polyline[i], polyline[i+1]);
    if (d < minD) minD = d;
  }
  return minD;
}

export function getBearing(p1: [number, number], p2: [number, number]) {
  const lat1 = p1[0] * Math.PI / 180;
  const lon1 = p1[1] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const lon2 = p2[1] * Math.PI / 180;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const θ = Math.atan2(y, x);
  const brng = (θ * 180 / Math.PI + 360) % 360; 
  return brng;
}

export function findClosestPointOnPolyline(p: [number, number], polyline: [number, number][]) {
  let minD = Infinity;
  let closestPoint: [number, number] = p;
  let segmentIndex = 0;
  
  for (let i = 0; i < polyline.length - 1; i++) {
    const v = polyline[i];
    const w = polyline[i+1];
    
    const l2 = Math.pow(v[0] - w[0], 2) + Math.pow(v[1] - w[1], 2);
    if (l2 === 0) {
      const d = getDistance(p, v);
      if (d < minD) {
        minD = d;
        closestPoint = v;
        segmentIndex = i;
      }
      continue;
    }
    
    let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection: [number, number] = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
    
    const d = getDistance(p, projection);
    if (d < minD) {
      minD = d;
      closestPoint = projection;
      segmentIndex = i;
    }
  }
  return { point: closestPoint, distance: minD, segmentIndex };
}

export function interpolatePoint(p1: [number, number], p2: [number, number], fraction: number): [number, number] {
  return [
    p1[0] + (p2[0] - p1[0]) * fraction,
    p1[1] + (p2[1] - p1[1]) * fraction
  ];
}

export function getPointAtDistance(cumulativeDistances: number[], routeCoordinates: [number, number][], targetDist: number): [number, number] {
  if (!routeCoordinates || routeCoordinates.length === 0) return [0, 0];
  const totalDist = cumulativeDistances[cumulativeDistances.length - 1] || 0;
  const d = Math.max(0, Math.min(totalDist, targetDist));

  let i = cumulativeDistances.findIndex((cd) => cd > d) - 1;
  if (i < 0) i = 0;
  if (i >= routeCoordinates.length - 1) return routeCoordinates[routeCoordinates.length - 1];

  const p1 = routeCoordinates[i];
  const p2 = routeCoordinates[i + 1];
  const segDist = cumulativeDistances[i + 1] - cumulativeDistances[i];
  const distInSeg = d - cumulativeDistances[i];
  const fraction = segDist > 0 ? distInSeg / segDist : 0;

  return interpolatePoint(p1, p2, fraction);
}
