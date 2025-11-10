"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VisualState =
  | "idle"
  | "hallway"
  | "knock"
  | "flashlight"
  | "empty"
  | "photo"
  | "glitch";

type SequenceStep =
  | {
      type: "speech";
      text: string;
      rate?: number;
      pitch?: number;
      delayAfter?: number;
      visual?: VisualState;
    }
  | {
      type: "pause";
      duration: number;
      visual?: VisualState;
    }
  | {
      type: "sound";
      sound: "knock-soft" | "knock-hard" | "heartbeat" | "glitch";
      delayAfter?: number;
      visual?: VisualState;
    }
  | {
      type: "text";
      text: string;
      duration: number;
      visual?: VisualState;
    }
  | {
      type: "final";
      text: string;
      visual?: VisualState;
    };

const STORY_SEQUENCE: SequenceStep[] = [
  { type: "text", text: "", duration: 500, visual: "hallway" },
  {
    type: "speech",
    text: "Raat ke do baje mere kamre ke darwaze pe kisi ne knock kiya…",
    rate: 0.82,
    pitch: 0.85,
    delayAfter: 700,
    visual: "hallway",
  },
  { type: "pause", duration: 1000, visual: "hallway" },
  {
    type: "speech",
    text: "Main akela tha ghar mein.",
    rate: 0.88,
    pitch: 0.8,
    delayAfter: 1000,
    visual: "hallway",
  },
  {
    type: "sound",
    sound: "knock-soft",
    delayAfter: 900,
    visual: "knock",
  },
  {
    type: "speech",
    text: "Pehle laga hawa hogi… lekin phir knock fir se hua — is baar zyada zor se.",
    rate: 0.84,
    pitch: 0.8,
    delayAfter: 600,
    visual: "knock",
  },
  {
    type: "sound",
    sound: "knock-hard",
    delayAfter: 1000,
    visual: "knock",
  },
  {
    type: "speech",
    text: "Main ne flashlight uthayi, aur darwaze ke paas gaya.",
    rate: 0.9,
    pitch: 0.82,
    delayAfter: 700,
    visual: "flashlight",
  },
  {
    type: "speech",
    text: "Andar se awaaz aayi… ek ladki ki halki si fusi hui aawaz — ‘Please… madad karo…’",
    rate: 1,
    pitch: 1.4,
    delayAfter: 900,
    visual: "flashlight",
  },
  { type: "pause", duration: 900, visual: "empty" },
  {
    type: "speech",
    text: "Darwaza kholte hi ek thandi hawa ka jhonka aaya… lekin koi nahi tha.",
    rate: 0.86,
    pitch: 0.78,
    delayAfter: 800,
    visual: "empty",
  },
  {
    type: "sound",
    sound: "heartbeat",
    delayAfter: 1000,
    visual: "empty",
  },
  {
    type: "speech",
    text: "Sirf floor pe ek purani polaroid photo padhi thi… meri.",
    rate: 0.84,
    pitch: 0.8,
    delayAfter: 800,
    visual: "photo",
  },
  {
    type: "sound",
    sound: "glitch",
    delayAfter: 1200,
    visual: "photo",
  },
  {
    type: "speech",
    text: "Lekin us photo mein main darwaze ke bahar khada tha.",
    rate: 0.82,
    pitch: 0.78,
    delayAfter: 1400,
    visual: "photo",
  },
  {
    type: "pause",
    duration: 2000,
    visual: "glitch",
  },
  {
    type: "speech",
    text: "Mujhe ab tak samajh nahi aaya… us raat knock kisne kiya tha — main to andar tha.",
    rate: 0.8,
    pitch: 0.75,
    delayAfter: 1500,
    visual: "glitch",
  },
  {
    type: "final",
    text: "👁️ “Sometimes… the one knocking isn’t outside.”",
    visual: "glitch",
  },
];

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const approximateSpeechDuration = (text: string, rate = 1) => {
  const sanitized = text.trim();
  const words = sanitized.length > 0 ? sanitized.split(/\s+/).length : 0;
  const base = Math.max(3, words) * 380; // milliseconds tuned for slow narration
  return Math.max(2400 / rate, base / rate);
};

const createKnock = (
  ctx: AudioContext,
  time: number,
  intensity: number,
  offset = 0,
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(85, time + offset);
  osc.frequency.exponentialRampToValueAtTime(45, time + offset + 0.14);

  gain.gain.setValueAtTime(0.0001, time + offset);
  gain.gain.exponentialRampToValueAtTime(0.9 * intensity, time + offset + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time + offset);
  osc.stop(time + offset + 0.32);
};

const createHeartbeat = (ctx: AudioContext, time: number) => {
  createKnock(ctx, time, 1);
  createKnock(ctx, time, 0.7, 0.25);
};

const createGlitch = (ctx: AudioContext, time: number) => {
  const duration = 0.6;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (Math.random() > 0.8 ? 0.75 : 0.2);
  }
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(1200, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.6, time + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(time);
  noise.stop(time + duration);
};

export default function Home() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [currentLine, setCurrentLine] = useState<string>("");
  const [visual, setVisual] = useState<VisualState>("idle");
  const [showPhoto, setShowPhoto] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const populateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === populateVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      activeUtteranceRef.current = null;
    };
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const pickNarratorVoice = useCallback(() => {
    const voices = voicesRef.current;
    if (!voices.length) {
      return null;
    }
    const hindiVoice =
      voices.find((voice) => voice.lang.toLowerCase().startsWith("hi")) ??
      voices.find((voice) => voice.lang.toLowerCase().includes("en-in"));
    const deepVoice =
      voices.find(
        (voice) =>
          voice.name.toLowerCase().includes("male") ||
          voice.name.toLowerCase().includes("deep"),
      ) ?? voices[0];
    return hindiVoice ?? deepVoice;
  }, []);

  const pickWhisperVoice = useCallback(() => {
    const voices = voicesRef.current;
    if (!voices.length) {
      return null;
    }
    const airyVoice =
      voices.find((voice) => voice.name.toLowerCase().includes("female")) ??
      voices.find((voice) => voice.lang.toLowerCase().includes("en-gb"));
    return airyVoice ?? voices[0];
  }, []);

  const speakLine = useCallback(
    async ({
      text,
      rate = 1,
      pitch = 1,
      tone,
    }: {
      text: string;
      rate?: number;
      pitch?: number;
      tone: "narrator" | "whisper";
    }) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        const fallbackDuration = approximateSpeechDuration(text, rate);
        await wait(fallbackDuration);
        return;
      }

      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice =
          tone === "whisper" ? pickWhisperVoice() : pickNarratorVoice();
        utterance.rate = rate;
        utterance.pitch = tone === "whisper" ? Math.min(pitch + 0.4, 2) : pitch;
        utterance.volume = tone === "whisper" ? 0.65 : 0.9;
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          activeUtteranceRef.current = null;
          resolve();
        };
        utterance.onerror = () => {
          activeUtteranceRef.current = null;
          resolve();
        };

        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [pickNarratorVoice, pickWhisperVoice],
  );

  const playSound = useCallback(
    async (kind: "knock-soft" | "knock-hard" | "heartbeat" | "glitch") => {
      const ctx = await ensureAudioContext();
      if (!ctx) {
        return;
      }
      const now = ctx.currentTime + 0.05;
      switch (kind) {
        case "knock-soft":
          createKnock(ctx, now, 0.45);
          createKnock(ctx, now + 0.28, 0.35);
          break;
        case "knock-hard":
          createKnock(ctx, now, 0.9);
          createKnock(ctx, now + 0.32, 0.85);
          break;
        case "heartbeat":
          createHeartbeat(ctx, now);
          break;
        case "glitch":
          createGlitch(ctx, now);
          break;
        default:
          break;
      }
    },
    [ensureAudioContext],
  );

  const resetExperience = useCallback(() => {
    setStatus("idle");
    setCurrentLine("");
    setVisual("idle");
    setShowPhoto(false);
    setStepIndex(0);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const runSequence = useCallback(async () => {
    if (status === "running") {
      return;
    }
    setStatus("running");
    setCurrentLine("");
    setVisual("hallway");
    setShowPhoto(false);
    setStepIndex(0);

    for (let i = 0; i < STORY_SEQUENCE.length; i += 1) {
      const step = STORY_SEQUENCE[i];
      setStepIndex(i + 1);
      if (step.visual) {
        setVisual(step.visual);
        if (step.visual === "photo") {
          setShowPhoto(true);
        }
      }

      if (step.type === "speech") {
        setCurrentLine(step.text);
        const tone = step.pitch && step.pitch > 1 ? "whisper" : "narrator";
        await speakLine({
          text: step.text,
          rate: step.rate ?? 1,
          pitch: step.pitch ?? 1,
          tone,
        });
        if (step.delayAfter) {
          await wait(step.delayAfter);
        }
      } else if (step.type === "pause") {
        await wait(step.duration);
      } else if (step.type === "sound") {
        await playSound(step.sound);
        if (step.delayAfter) {
          await wait(step.delayAfter);
        }
      } else if (step.type === "text") {
        setCurrentLine(step.text);
        await wait(step.duration);
      } else if (step.type === "final") {
        setCurrentLine(step.text);
      }
    }

    setStatus("done");
  }, [playSound, speakLine, status]);

  const progressValue = useMemo(() => {
    return Math.min(100, Math.round((stepIndex / STORY_SEQUENCE.length) * 100));
  }, [stepIndex]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  const sceneClassName = useMemo(
    () =>
      clsx(
        "experience-scene",
        {
          "scene-hallway": visual === "hallway",
          "scene-knock": visual === "knock",
          "scene-flashlight": visual === "flashlight",
          "scene-empty": visual === "empty",
          "scene-photo": visual === "photo",
          "scene-glitch": visual === "glitch",
        },
        visual === "idle" && "scene-idle",
      ),
    [visual],
  );

  return (
    <main className="experience">
      <div className={sceneClassName} aria-hidden />
      <div className="overlay">
        <div className="inner">
          <div className="tagline">
            <span className="dot" />
            NIGHT ARCHIVE : FILE 50208165
          </div>
          <h1 className="title">THE KNOCK</h1>
          <p className="subtitle">
            Put on headphones, dim the lights, and listen closely.
          </p>
          <div className="canvas">
            {showPhoto && (
              <div className="polaroid" role="img" aria-label="Polaroid photo">
                <div className="polaroid-frame">
                  <div className="silhouette" />
                </div>
                <span className="caption">Doorstep · 02:03 AM</span>
              </div>
            )}
            <div className="narration">
              <p className={clsx("line", status === "done" && "line-final")}>
                {currentLine}
              </p>
              {status === "idle" && (
                <button
                  type="button"
                  className="start-button"
                  onClick={runSequence}
                >
                  Start the Night
                </button>
              )}
              {status === "done" && (
                <button
                  type="button"
                  className="restart-button"
                  onClick={resetExperience}
                >
                  Replay
                </button>
              )}
            </div>
          </div>
          <div className="meta">
            <div className="progress-bar">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <span className="progress-label">
                {status === "idle"
                  ? "Awaiting input"
                  : status === "running"
                    ? "Capturing encounter..."
                    : "Log saved"}
              </span>
            </div>
            <div className="notes">
              <span>Headphones recommended</span>
              <span>Auto narration uses SpeechSynthesis</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
