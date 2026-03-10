import { requestJson } from "./http";
import type { JourneyResponse, JourneysResponse } from "../types/journey";

export function listJourneys(token: string) {
  return requestJson<JourneysResponse>("/journeys", { token });
}

export function createJourney(
  token: string,
  payload: { title: string; category?: string | null; colorTheme?: string | null; goalText?: string | null }
) {
  return requestJson<JourneyResponse>("/journeys", {
    token,
    method: "POST",
    body: payload
  });
}

export function updateJourney(
  token: string,
  journeyId: string,
  payload: { title?: string; category?: string | null; colorTheme?: string | null; goalText?: string | null }
) {
  return requestJson<JourneyResponse>(`/journeys/${journeyId}`, {
    token,
    method: "PATCH",
    body: payload
  });
}

export function archiveJourney(token: string, journeyId: string) {
  return requestJson<{ success: boolean }>(`/journeys/${journeyId}`, {
    token,
    method: "DELETE"
  });
}
