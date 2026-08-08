"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import type { CampusExperienceDto } from "@mentor/types";

import type { CampusWalkEvent } from "./campus-walk-state";
import { configureGoogleMapsLoader } from "./google-maps-loader";

const STREET_VIEW_SEARCH_RADIUS_METERS = 120;
const AVATAR_SETTLE_DELAY_MILLIS = 850;

export type CampusWalkAvailability =
  | "CHECKING"
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "ERROR";

type CampusPoi = CampusExperienceDto["pois"][number];

export function CampusStreetView({
  active,
  poi,
  locale,
  onAvailabilityChange,
  onWalkEvent,
}: {
  active: boolean;
  poi: CampusPoi;
  locale: string;
  onAvailabilityChange: (availability: CampusWalkAvailability) => void;
  onWalkEvent: (event: CampusWalkEvent) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.StreetViewService | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const settleTimerRef = useRef<number | null>(null);
  const programmaticMoveUntilRef = useRef(0);
  const activePoiIdRef = useRef(poi.id);
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  const onWalkEventRef = useRef(onWalkEvent);
  const [library, setLibrary] = useState<google.maps.StreetViewLibrary | null>(null);
  const [resolvedPanorama, setResolvedPanorama] = useState<{
    poiId: string;
    pano: string;
  } | null>(null);

  useEffect(() => {
    activePoiIdRef.current = poi.id;
    onWalkEventRef.current({ type: "POI_CHANGED", poiId: poi.id });
  }, [poi.id]);

  useEffect(() => {
    onAvailabilityChangeRef.current = onAvailabilityChange;
  }, [onAvailabilityChange]);

  useEffect(() => {
    onWalkEventRef.current = onWalkEvent;
  }, [onWalkEvent]);

  useEffect(() => {
    if (!configureGoogleMapsLoader(locale)) {
      onAvailabilityChangeRef.current("ERROR");
      return;
    }

    let current = true;
    void importLibrary("streetView")
      .then((nextLibrary) => {
        if (current) setLibrary(nextLibrary as google.maps.StreetViewLibrary);
      })
      .catch(() => {
        if (current) onAvailabilityChangeRef.current("ERROR");
      });

    return () => {
      current = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!library) return;

    let current = true;
    onAvailabilityChangeRef.current("CHECKING");
    serviceRef.current ??= new library.StreetViewService();

    void serviceRef.current
      .getPanorama({
        location: {
          lat: poi.camera.center.lat,
          lng: poi.camera.center.lng,
        },
        preference: library.StreetViewPreference.NEAREST,
        radius: STREET_VIEW_SEARCH_RADIUS_METERS,
        sources: [library.StreetViewSource.OUTDOOR],
      })
      .then(({ data }) => {
        if (!current) return;
        const pano = data.location?.pano;
        if (!pano) {
          onAvailabilityChangeRef.current("UNAVAILABLE");
          return;
        }
        setResolvedPanorama({ poiId: poi.id, pano });
        onAvailabilityChangeRef.current("AVAILABLE");
      })
      .catch((error: unknown) => {
        if (!current) return;
        onAvailabilityChangeRef.current(
          isZeroResults(error) ? "UNAVAILABLE" : "ERROR",
        );
      });

    return () => {
      current = false;
    };
  }, [library, poi.camera.center.lat, poi.camera.center.lng, poi.id]);

  useEffect(() => {
    const host = hostRef.current;
    if (
      !active ||
      !host ||
      !library ||
      !resolvedPanorama ||
      resolvedPanorama.poiId !== poi.id
    ) {
      panoramaRef.current?.setVisible(false);
      return;
    }

    const emitSettled = () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
      const poiId = activePoiIdRef.current;
      settleTimerRef.current = window.setTimeout(() => {
        onWalkEventRef.current({ type: "MOTION_SETTLED", poiId });
      }, AVATAR_SETTLE_DELAY_MILLIS);
    };

    if (!panoramaRef.current) {
      const panorama = new library.StreetViewPanorama(host, {
        pano: resolvedPanorama.pano,
        pov: { heading: poi.camera.heading, pitch: 0 },
        zoom: 0,
        addressControl: false,
        clickToGo: true,
        disableDefaultUI: false,
        fullscreenControl: true,
        linksControl: true,
        motionTracking: false,
        motionTrackingControl: false,
        panControl: true,
        scrollwheel: true,
        showRoadLabels: true,
        visible: true,
        zoomControl: true,
      });
      panoramaRef.current = panorama;

      const reportMovement = () => {
        const poiId = activePoiIdRef.current;
        onWalkEventRef.current({
          type:
            Date.now() <= programmaticMoveUntilRef.current
              ? "PANORAMA_READY"
              : "PANORAMA_MOVED",
          poiId,
        });
        emitSettled();
      };
      listenersRef.current = [
        panorama.addListener("pano_changed", reportMovement),
        panorama.addListener("position_changed", reportMovement),
      ];
    }

    programmaticMoveUntilRef.current = Date.now() + AVATAR_SETTLE_DELAY_MILLIS;
    onWalkEventRef.current({ type: "PANORAMA_READY", poiId: poi.id });
    panoramaRef.current.setPano(resolvedPanorama.pano);
    panoramaRef.current.setPov({ heading: poi.camera.heading, pitch: 0 });
    panoramaRef.current.setVisible(true);
    emitSettled();
  }, [active, library, poi.camera.heading, poi.id, resolvedPanorama]);

  useEffect(
    () => () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
      for (const listener of listenersRef.current) listener.remove();
      listenersRef.current = [];
      panoramaRef.current?.setVisible(false);
      panoramaRef.current = null;
      hostRef.current?.replaceChildren();
    },
    [],
  );

  return (
    <div
      ref={hostRef}
      className={`absolute inset-0 min-h-[24rem] w-full bg-[var(--color-surface-soft)] transition-opacity duration-300 ${
        active
          ? "visible z-10 opacity-100"
          : "invisible pointer-events-none z-0 opacity-0"
      }`}
      aria-hidden={!active}
      data-testid="campus-street-view"
    />
  );
}

function isZeroResults(error: unknown): boolean {
  if (typeof error === "string") return error.includes("ZERO_RESULTS");
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  return [candidate.code, candidate.message, candidate.status].some(
    (value) => typeof value === "string" && value.includes("ZERO_RESULTS"),
  );
}
