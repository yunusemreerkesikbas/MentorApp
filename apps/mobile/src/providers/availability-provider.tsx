import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppAvailabilityDto } from "@mentor/types";
import { http } from "@mentor/api-client";

const DEFAULT_AVAILABILITY: AppAvailabilityDto = {
  aiCoach: true,
  social: true,
  forum: true,
  studyRooms: true,
  humanCoaching: true,
  studentPurchases: true,
  coachPurchases: true,
  studentSignup: true,
  coachSignup: true,
  coachRegistration: true,
  economy: true,
  invites: true,
  signupWaitlist: false,
};

interface AvailabilityContextValue {
  availability: AppAvailabilityDto;
  isLoading: boolean;
}

const AvailabilityContext = createContext<AvailabilityContextValue>({
  availability: DEFAULT_AVAILABILITY,
  isLoading: false,
});

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["app", "availability"],
    queryFn: () => http<AppAvailabilityDto>("/v1/app/availability"),
    staleTime: 60_000,
  });

  const value = useMemo<AvailabilityContextValue>(
    () => ({
      availability: data ?? DEFAULT_AVAILABILITY,
      isLoading,
    }),
    [data, isLoading],
  );

  return (
    <AvailabilityContext.Provider value={value}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAppAvailability(): AvailabilityContextValue {
  return useContext(AvailabilityContext);
}
