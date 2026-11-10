/**
 * One availability read per landing render, shared by the sections that hide a feature when its
 * flag is off (Odak odası's tables, Gece Yolculuğu, the city's league rows). Null means unknown and
 * reads as off: the landing never advertises something it cannot confirm is on.
 */
export { fetchAppAvailability as landingAvailability } from "@/lib/app-availability-server";
