export type Clip = {
  id: string;
  journeyId: string;
  recordedOn: string;
  recordedAt: string;
  durationMs: number;
  captureType: "video" | "photo";
  videoUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadUrlResponse = {
  uploadId: string;
  uploadUrl: string;
  uploadMethod: "POST";
  fileField: string;
  mediaUrl: string;
};

export type ClipResponse = {
  clip: Clip;
};

export type ClipsResponse = {
  clips: Clip[];
};
