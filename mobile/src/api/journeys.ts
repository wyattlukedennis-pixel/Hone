import { requestJson } from "./http";
import type { JourneyResponse, JourneysResponse, JourneyRevealsResponse, NextMilestoneResponse } from "../types/journey";

export function listJourneys(token: string) {
  return requestJson<JourneysResponse>("/journeys", { token });
}

export function createJourney(
  token: string,
  payload: {
    title: string;
    category?: string | null;
    colorTheme?: string | null;
    goalText?: string | null;
    captureMode?: "video" | "photo";
    milestoneLengthDays?: number;
  }
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
  payload: {
    title?: string;
    category?: string | null;
    colorTheme?: string | null;
    goalText?: string | null;
    captureMode?: "video" | "photo";
    milestoneLengthDays?: number;
  }
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

export function listJourneyReveals(token: string, journeyId: string) {
  return requestJson<JourneyRevealsResponse>(`/journeys/${journeyId}/reveals`, {
    token
  });
}

export function startNextMilestone(token: string, journeyId: string, milestoneLengthDays: number) {
  return requestJson<NextMilestoneResponse>(`/journeys/${journeyId}/next-milestone`, {
    token,
    method: "POST",
    body: { milestoneLengthDays }
  });
}

