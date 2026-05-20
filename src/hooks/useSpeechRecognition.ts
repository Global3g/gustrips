'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(opts?: {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}): UseSpeechRecognition {
  const lang = opts?.lang ?? 'es-MX';
  const continuous = opts?.continuous ?? false;
  const interimResults = opts?.interimResults ?? true;

  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef<string>('');

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    setSupported(Ctor !== null);
  }, []);

  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      if (r) {
        try {
          r.onresult = null;
          r.onerror = null;
          r.onend = null;
          r.onstart = null;
          r.abort();
        } catch {
          // ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    // If already running, don't start a new one
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const instance = new Ctor();
    instance.lang = lang;
    instance.continuous = continuous;
    instance.interimResults = interimResults;
    instance.maxAlternatives = 1;

    finalRef.current = '';
    setTranscript('');

    instance.onstart = () => {
      setListening(true);
    };

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          finalRef.current = (finalRef.current ? finalRef.current + ' ' : '') + alt.transcript.trim();
        } else {
          interim += alt.transcript;
        }
      }
      const combined = finalRef.current + (interim ? (finalRef.current ? ' ' : '') + interim : '');
      setTranscript(combined);
    };

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
       
      console.warn('[useSpeechRecognition] error', event.error, event.message ?? '');
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
    };

    recognitionRef.current = instance;
    try {
      instance.start();
    } catch (err) {
       
      console.warn('[useSpeechRecognition] start failed', err);
      setListening(false);
    }
  }, [lang, continuous, interimResults]);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
  }, []);

  return { supported, listening, transcript, start, stop, reset };
}
