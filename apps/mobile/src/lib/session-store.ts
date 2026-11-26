import * as SecureStore from "expo-secure-store";
import { SESSION_ACTUAL_SECONDS_MAX } from "@mentor/types";
import {
  readActiveSessionRecord,
  readAmbientPreference,
  resolveSessionResume,
  type ActiveSessionRecord,
  type ResumeResolution,
  readSessionScene,
  type AmbientPreference,
  type SessionScene,
} from "./session-view.js";

// The web's localStorage `mentor.session.scene` and `mentor.session.ambientSound`. ponytail: two
// short JSON strings in SecureStore, the only key-value store installed; its sync read lets the
// first frame open in the saved room.
const SCENE_KEY = "mentor.session.scene.v1";
const AMBIENT_KEY = "mentor.session.ambient.v1";
// The web's `mentor.session.active`: a running session, so leaving the screen does not lose it.
const ACTIVE_KEY = "mentor.session.active.v1";

function read(key: string): string | null {
  try {
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}

function remove(key: string): void {
  try {
    void SecureStore.deleteItemAsync(key);
  } catch {
    // Worst case the next open sees a stale record and resolves it to done or discard.
  }
}

function write(key: string, value: unknown): void {
  try {
    SecureStore.setItem(key, JSON.stringify(value));
  } catch {
    // A lost write only reopens the default room or silence next time.
  }
}

export const loadSessionScene = (): SessionScene => readSessionScene(read(SCENE_KEY));
export const saveSessionScene = (scene: SessionScene) => write(SCENE_KEY, scene);
export const loadAmbientPreference = (): AmbientPreference => readAmbientPreference(read(AMBIENT_KEY));
export const saveAmbientPreference = (preference: AmbientPreference) => write(AMBIENT_KEY, preference);
export const saveActiveSession = (record: ActiveSessionRecord) => write(ACTIVE_KEY, record);
export const clearActiveSession = () => remove(ACTIVE_KEY);

export interface SessionResume { record: ActiveSessionRecord; resolution: ResumeResolution }

/** What a freshly opened session screen picks up; spent records (done, too old) are dropped here. */
export function loadSessionResume(): SessionResume | null {
  const record = readActiveSessionRecord(read(ACTIVE_KEY));
  if (!record) return null;
  const resolution = resolveSessionResume(record, Date.now(), SESSION_ACTUAL_SECONDS_MAX * 1000);
  if (resolution.kind === "done" || resolution.kind === "discard") {
    clearActiveSession();
    return null;
  }
  return { record, resolution };
}
