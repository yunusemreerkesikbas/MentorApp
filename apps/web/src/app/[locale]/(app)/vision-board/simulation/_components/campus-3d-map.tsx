"use client";

import { useEffect, useRef } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type {
  CampusCameraPresetDto,
  CampusExperienceDto,
} from "@mentor/types";

let loaderConfigured = false;

export function Campus3DMap({
  campus,
  camera,
  activePoiId,
  locale,
  reducedMotion,
  onSelectPoi,
  onError,
}: {
  campus: CampusExperienceDto;
  camera: CampusCameraPresetDto;
  activePoiId: string | null;
  locale: string;
  reducedMotion: boolean;
  onSelectPoi: (poiId: string) => void;
  onError: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const cameraRef = useRef(camera);
  const onSelectPoiRef = useRef(onSelectPoi);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSelectPoiRef.current = onSelectPoi;
  }, [onSelectPoi]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const host = hostRef.current;
    if (!host || !apiKey) {
      onErrorRef.current();
      return;
    }

    let active = true;
    if (!loaderConfigured) {
      setOptions({
        key: apiKey,
        v: "weekly",
        language: locale,
        region: "TR",
        authReferrerPolicy: "origin",
      });
      loaderConfigured = true;
    }

    void importLibrary("maps3d")
      .then((library) => {
        if (!active) return;
        const { Map3DElement, MapMode, Marker3DInteractiveElement } =
          library as google.maps.Maps3DLibrary;
        const initialCamera = cameraRef.current;
        const map = new Map3DElement({
          center: initialCamera.center,
          heading: initialCamera.heading,
          tilt: initialCamera.tilt,
          range: initialCamera.range,
          mode:
            campus.renderMode === "HYBRID" ? MapMode.HYBRID : MapMode.SATELLITE,
          gestureHandling: "COOPERATIVE",
          description: campus.universityName,
        });
        map.className = "h-full w-full";
        map.addEventListener("gmp-error", () => onErrorRef.current());

        for (const poi of campus.pois) {
          const marker = new Marker3DInteractiveElement({
            position: poi.camera.center,
            label: String(poi.position),
            title: poi.title,
            altitudeMode: "RELATIVE_TO_GROUND",
            extruded: true,
            sizePreserved: true,
          });
          marker.tabIndex = 0;
          marker.setAttribute("role", "button");
          marker.setAttribute("aria-label", poi.title);
          const select = () => onSelectPoiRef.current(poi.id);
          marker.addEventListener("gmp-click", select);
          marker.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select();
            }
          });
          map.append(marker);
        }

        host.replaceChildren(map);
        mapRef.current = map;
      })
      .catch(() => onErrorRef.current());

    return () => {
      active = false;
      mapRef.current?.stopCameraAnimation();
      mapRef.current = null;
      host.replaceChildren();
    };
  }, [campus, locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (reducedMotion) {
      map.stopCameraAnimation();
      map.center = camera.center;
      map.heading = camera.heading;
      map.tilt = camera.tilt;
      map.range = camera.range;
      return;
    }
    map.flyCameraTo({
      endCamera: {
        center: camera.center,
        heading: camera.heading,
        tilt: camera.tilt,
        range: camera.range,
      },
      durationMillis: 1800,
    });
  }, [activePoiId, camera, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-[24rem] w-full bg-[var(--color-surface-soft)]"
      data-testid="campus-3d-map"
    />
  );
}
