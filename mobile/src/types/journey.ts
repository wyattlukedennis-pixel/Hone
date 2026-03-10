export type Journey = {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  colorTheme: string | null;
  goalText: string | null;
  startedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JourneysResponse = {
  journeys: Journey[];
};

export type JourneyResponse = {
  journey: Journey;
};
