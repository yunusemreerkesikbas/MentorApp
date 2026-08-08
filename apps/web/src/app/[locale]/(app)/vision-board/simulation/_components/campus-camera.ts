import type { CampusCameraPresetDto } from "@mentor/types";

export function buildGroundRelativeCameraOptions(
  camera: CampusCameraPresetDto,
): google.maps.maps3d.CameraOptions {
  return {
    altitudeMode: "RELATIVE_TO_GROUND",
    center: camera.center,
    heading: camera.heading,
    tilt: camera.tilt,
    range: camera.range,
  };
}
