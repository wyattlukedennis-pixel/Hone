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
import type { SkillPack } from "../../utils/skillPack";
import type { User } from "../../types/auth";

import { HookScreen } from "./HookScreen";
import { SkillPickerScreen } from "./SkillPickerScreen";
import { GoalScreen } from "./GoalScreen";
import { RecordExplainerScreen } from "./RecordExplainerScreen";
import { OnboardingRecorderScreen } from "./OnboardingRecorderScreen";
import { SignupScreen } from "./SignupScreen";

type OnboardingStep = "hook" | "skill" | "goal" | "signup" | "explainer" | "camera";

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

const SKILL_LABELS: Record<string, string> = {
  instrument: "music",
  drawing: "drawing",
  fitness: "fitness",
};

function buildJourneyTitle(skillPack: SkillPack | "other", customName: string | null): string {
  if (skillPack === "other" && customName) {
    return `my ${customName.toLowerCase().trim()} journey`;
  }
  const label = SKILL_LABELS[skillPack] ?? "practice";
  return `my ${label} journey`;
}

function resolveSkillLabel(skillPack: SkillPack | "other", customName: string | null): string {
  if (skillPack === "other" && customName) return customName.toLowerCase().trim();
  return SKILL_LABELS[skillPack] ?? "practice";
}

export function OnboardingFlow({ onComplete, onSkipToLogin }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>("hook");
  const [selectedSkillPack, setSelectedSkillPack] = useState<SkillPack | "other">("instrument");
  const [customSkillName, setCustomSkillName] = useState<string | null>(null);
  const [goalText, setGoalText] = useState<string | null>(null);
  const [captureType, setCaptureType] = useState<"video" | "photo">("video");
  const [, setClipData] = useState<ClipData | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<{ token: string; user: User; journeyId: string } | null>(null);

  function handleGetStarted() {
    trackEvent("onboarding_started", {});
    setStep("skill");
  }

  function handleSkillSelect(skillPack: SkillPack | "other", customName: string | null) {
    setSelectedSkillPack(skillPack);
    setCustomSkillName(customName);
    trackEvent("onboarding_skill_selected", { skillPack, isCustom: skillPack === "other" });
    setStep("goal");
  }

  function handleGoalContinue(text: string | null) {
    setGoalText(text);
    trackEvent("onboarding_goal_set", { hasGoal: Boolean(text) });
    setStep("signup");
  }

  function handleExplainerContinue(selectedCaptureType: "video" | "photo") {
    setCaptureType(selectedCaptureType);
    setStep("camera");
  }

  async function handleClipSaved(clip: ClipData) {
    setClipData(clip);
    trackEvent("onboarding_clip_recorded", { durationMs: clip.durationMs });

    // Upload clip now that we have auth session from earlier signup
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
    // Skip recording and finish onboarding
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
      // 1. Create account
      const authResponse = await signup(values);
      const { token, user } = authResponse;
      await saveAuthToken(token);

      // 2. Create journey
      const effectiveSkillPack: SkillPack = selectedSkillPack === "other" ? "fitness" : selectedSkillPack;
      const title = buildJourneyTitle(selectedSkillPack, customSkillName);
      const category = selectedSkillPack === "other" ? customSkillName : null;

      const { journey } = await createJourney(token, {
        title,
        skillPack: effectiveSkillPack,
        category,
        goalText,
        captureMode: captureType,
        milestoneLengthDays: 7,
      });

      // Store session for use after recording
      setAuthSession({ token, user, journeyId: journey.id });

      trackEvent("onboarding_signup_success", { userId: user.id });

      // 3. Proceed to record instructions
      setStep("explainer");
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

      {step === "skill" && (
        <SkillPickerScreen onSelect={handleSkillSelect} />
      )}

      {step === "goal" && (
        <GoalScreen
          skillLabel={resolveSkillLabel(selectedSkillPack, customSkillName)}
          onContinue={handleGoalContinue}
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

              const effectiveSkillPack: SkillPack = selectedSkillPack === "other" ? "fitness" : selectedSkillPack;
              const title = buildJourneyTitle(selectedSkillPack, customSkillName);
              const category = selectedSkillPack === "other" ? customSkillName : null;

              const { journey } = await createJourney(token, {
                title,
                skillPack: effectiveSkillPack,
                category,
                goalText,
                captureMode: captureType,
                milestoneLengthDays: 7,
              });

              setAuthSession({ token, user, journeyId: journey.id });
              trackEvent("onboarding_apple_signup_success", { userId: user.id });
              setStep("explainer");
            } catch (error) {
              const message = error instanceof Error ? error.message : "something went wrong. try again.";
              setSignupError(message.toLowerCase());
              setSignupLoading(false);
            }
          }}
        />
      )}

      {step === "explainer" && (
        <RecordExplainerScreen
          skillLabel={resolveSkillLabel(selectedSkillPack, customSkillName)}
          onContinue={handleExplainerContinue}
        />
      )}

      {step === "camera" && (
        <OnboardingRecorderScreen
          skillPack={selectedSkillPack === "other" ? "fitness" : selectedSkillPack}
          journeyTitle={buildJourneyTitle(selectedSkillPack, customSkillName)}
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
