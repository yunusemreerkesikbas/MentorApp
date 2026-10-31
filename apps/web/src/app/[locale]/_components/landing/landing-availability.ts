import { cache } from "react";
import { fetchAppAvailability } from "@/lib/app-availability-server";

/**
 * One availability read per landing render, shared by the sections that hide a feature when its
 * flag is off (Odak odası's tables, Gece Yolculuğu, the city's league rows). Null means unknown and
 * reads as off: the landing never advertises something it cannot confirm is on.
 */
export const landingAvailability = cache(fetchAppAvailability);
