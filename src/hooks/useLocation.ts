import { useEffect, useRef, useState } from 'react';
import { updateUserLocation } from '../lib/supabase';

export type Coords = { latitude: number; longitude: number };

const MIN_INTERVAL_MS = 60_000;

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const lastUpdated = useRef<number>(0);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    (async () => {
      try {
        // Dynamic import so a missing native module doesn't crash the app
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15 },
          async (loc: any) => {
            const { latitude, longitude } = loc.coords;
            setCoords({ latitude, longitude });

            const now = Date.now();
            if (now - lastUpdated.current > MIN_INTERVAL_MS) {
              lastUpdated.current = now;
              await updateUserLocation(latitude, longitude);
            }
          }
        );
      } catch {
        // Native module unavailable — location silently disabled until rebuild
      }
    })();

    return () => { sub?.remove(); };
  }, []);

  return coords;
}
