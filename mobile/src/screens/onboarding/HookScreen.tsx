import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic } from "../../utils/feedback";

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function HookScreen({ onGetStarted, onSignIn }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.displayText}>
          {"track your progress.\nprove it to yourself."}
        </Text>
      </Animated.View>

      <Animated.View
        style={[styles.bottom, { opacity: fadeAnim }]}
      >
        <TactilePressable
          onPress={() => {
            triggerSelectionHaptic();
            onGetStarted();
          }}
        >
          <LinearGradient
            colors={theme.gradients.primaryAction}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>get started</Text>
          </LinearGradient>
        </TactilePressable>

        <Pressable
          onPress={() => {
            triggerSelectionHaptic();
            onSignIn();
          }}
          hitSlop={12}
        >
          <Text style={styles.signInText}>
            already have an account? sign in
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgStart,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  displayText: {
    fontSize: 32,
    fontFamily: theme.typography.display,
    textAlign: "center",
    color: theme.colors.textPrimary,
  },
  bottom: {
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  ctaButton: {
    height: 58,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  signInText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
});
