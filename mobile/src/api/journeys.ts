import { requestJson } from "./http";
import type {
  JourneyResponse,
  JourneysResponse,
  JourneyRevealsResponse,
  NextMilestoneResponse,
  JourneyWeeklyQuestCompletionsResponse,
  JourneyWeeklyQuestCompletionResponse
} from "../types/journey";

function normalizeJourney<T extends { skillPack?: unknown }>(journey: T): T & { skillPack: "fitness" | "drawing" | "instrument" } {
  const skillPack = journey.skillPack;
  if (skillPack === "fitness" || skillPack === "drawing" || skillPack === "instrument") {
    return journey as T & { skillPack: "fitness" | "drawing" | "instrument" };
  }
  return {
    ...journey,
    skillPack: "fitness"
  };
}

export function listJourneys(token: string) {
  return requestJson<JourneysResponse>("/journeys", { token }).then((response) => ({
    ...response,
    journeys: response.journeys.map((journey) => normalizeJourney(journey))
  }));
}

export function createJourney(
  token: string,
  payload: {
    title: string;
    skillPack?: "fitness" | "drawing" | "instrument";
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
  }).then((response) => ({
    ...response,
    journey: normalizeJourney(response.journey)
  }));
}

export function updateJourney(
  token: string,
  journeyId: string,
  payload: {
    title?: string;
    skillPack?: "fitness" | "drawing" | "instrument";
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
  }).then((response) => ({
    ...response,
    journey: normalizeJourney(response.journey)
  }));
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
  }).then((response) => ({
    ...response,
    journey: normalizeJourney(response.journey)
  }));
}

export function listJourneyWeeklyQuests(token: string, journeyId: string) {
  return requestJson<JourneyWeeklyQuestCompletionsResponse>(`/journeys/${journeyId}/weekly-quests`, { token });
}

export function completeJourneyWeeklyQuest(
  token: string,
  journeyId: string,
  payload: { weekKey: string; questId: string; rewardXp: number }
) {
  return requestJson<JourneyWeeklyQuestCompletionResponse>(`/journeys/${journeyId}/weekly-quests/complete`, {
    token,
    method: "POST",
    body: payload
  });
}
