import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { appleAuth, signup } from "../../api/auth";
import { createJourney } from "../../api/journeys";
import { saveAuthToken } from "../../storage/authStorage";
import {
  clearOnboardingDraft,
  markOnboardingComplete,
} from "../../storage/onboardingStorage";
import { enqueueClipUpload, processClipUploadQueue } from "../../storage/clipUploadQueue";
import { trackEvent } from "../../analytics/events";
import type { User } from "../../types/auth";

import { HookScreen } from "./HookScreen";
import { RecordExplainerScreen } from "./RecordExplainerScreen";
import { TitleScreen } from "./TitleScreen";
import { OnboardingRecorderScreen } from "./OnboardingRecorderScreen";
import { SignupScreen } from "./SignupScreen";

type OnboardingStep = "hook" | "explainer" | "title" | "signup" | "camera";

type ClipData = {
  uri: string;
  durationMs: number;
  recordedAt: string;
  recordedOn: string;
  captureType: "video" | "photo";
};

type OnboardingFlowProps = {
  onComplete: (session: { token: string; user: User }) => void;
  onSkipToLogin: () => void;
};

export function OnboardingFlow({ onComplete, onSkipToLogin }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>("hook");
  const [captureType, setCaptureType] = useState<"video" | "photo">("video");
  const [journeyTitle, setJourneyTitle] = useState<string>("my journey");
  const [, setClipData] = useState<ClipData | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<{ token: string; user: User; journeyId: string } | null>(null);

  function handleGetStarted() {
    trackEvent("onboarding_started", {});
    setStep("explainer");
  }

  function handleExplainerContinue(selectedCaptureType: "video" | "photo") {
    setCaptureType(selectedCaptureType);
    trackEvent("onboarding_capture_type_selected", { captureType: selectedCaptureType });
    setStep("title");
  }

  function handleTitleContinue(title: string) {
    setJourneyTitle(title);
    trackEvent("onboarding_title_set", { title });
    setStep("signup");
  }

  async function handleClipSaved(clip: ClipData) {
    setClipData(clip);
    trackEvent("onboarding_clip_recorded", { durationMs: clip.durationMs });

    if (authSession) {
      await enqueueClipUpload({
        journeyId: authSession.journeyId,
        captureType: clip.captureType,
        fileUri: clip.uri,
        durationMs: clip.durationMs,
        recordedAt: clip.recordedAt,
        recordedOn: clip.recordedOn,
      });
      void processClipUploadQueue(authSession.token);
    }

    await markOnboardingComplete();
    await clearOnboardingDraft();

    if (authSession) {
      onComplete({ token: authSession.token, user: authSession.user });
    }
  }

  async function handleCameraCancel() {
    await markOnboardingComplete();
    await clearOnboardingDraft();

    if (authSession) {
      onComplete({ token: authSession.token, user: authSession.user });
    }
  }

  async function handleSignupSubmit(values: { email: string; password: string; displayName: string }) {
    setSignupLoading(true);
    setSignupError(null);

    try {
      const authResponse = await signup(values);
      const { token, user } = authResponse;
      await saveAuthToken(token);

      const { journey } = await createJourney(token, {
        title: journeyTitle,
        skillPack: "fitness",
        captureMode: captureType,
        milestoneLengthDays: 7,
      });

      setAuthSession({ token, user, journeyId: journey.id });
      trackEvent("onboarding_signup_success", { userId: user.id });
      setStep("camera");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "something went wrong. try again.";
      setSignupError(message.toLowerCase());
      setSignupLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {step === "hook" && (
        <HookScreen
          onGetStarted={handleGetStarted}
          onSignIn={() => {
            trackEvent("onboarding_skipped_to_login", {});
            void markOnboardingComplete().then(onSkipToLogin);
          }}
        />
      )}

      {step === "explainer" && (
        <RecordExplainerScreen
          onContinue={handleExplainerContinue}
        />
      )}

      {step === "title" && (
        <TitleScreen
          captureType={captureType}
          onContinue={handleTitleContinue}
        />
      )}

      {step === "signup" && (
        <SignupScreen
          loading={signupLoading}
          errorMessage={signupError}
          onSubmit={handleSignupSubmit}
          onAppleAuth={async (result) => {
            setSignupLoading(true);
            setSignupError(null);
            try {
              const authResponse = await appleAuth(result);
              const { token, user } = authResponse;
              await saveAuthToken(token);

              const { journey } = await createJourney(token, {
                title: journeyTitle,
                skillPack: "fitness",
                captureMode: captureType,
                milestoneLengthDays: 7,
              });

              setAuthSession({ token, user, journeyId: journey.id });
              trackEvent("onboarding_apple_signup_success", { userId: user.id });
              setStep("camera");
            } catch (error) {
              const message = error instanceof Error ? error.message : "something went wrong. try again.";
              setSignupError(message.toLowerCase());
              setSignupLoading(false);
            }
          }}
        />
      )}

      {step === "camera" && (
        <OnboardingRecorderScreen
          skillPack="fitness"
          journeyTitle={journeyTitle}
          captureType={captureType}
          onClipSaved={handleClipSaved}
          onCancel={handleCameraCancel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
