'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createComplaintEmbedding } from '../lib/embeddings';

/* ============================================================================
 * CitizenIntakeForm.tsx
 *
 * Mobile-first, chat-like intake form for reporting civic issues.
 *  - Asks, one at a time: title -> description -> category (optional)
 *    -> photos (optional) -> privacy (Public / Anonymous) -> review.
 *  - Auto-fetches coordinates via the HTML5 Geolocation API on mount.
 *  - Compresses photo uploads to WebP (< 500 KB) client-side with the
 *    Canvas API, before anything is sent to a server.
 *  - Submits a multipart POST to `/api/complaints` by default (override with
 *    `apiEndpoint` or `onSubmit`), managing offline/error/success states.
 *  - Surfaces semantic duplicate feedback: when the API returns a `cluster`
 *    payload, asks the citizen whether they want to upvote the earlier report.
 * ==========================================================================*/

/* ----------------------------------------------------------------------------
 * Shared types (exported so the future API route can reuse them)
 * -------------------------------------------------------------------------- */

export interface CategoryOption {
  code: string;
  label: string;
}

interface SubdivisionOption {
  code: string;
  name: string;
  parentCode: string;
}

interface SimilarComplaint {
  id: number;
  title: string;
  description: string;
  status: string;
  category: string;
  similarity: number;
}

export interface WebpPhoto {
  /** Ready-to-upload WebP file, guaranteed < 500 KB. */
  file: File;
  /** Local object URL used for previews only (never uploaded). */
  previewUrl: string;
  size: number; // bytes
  width: number;
  height: number;
}

export interface IntakePayload {
  title: string;
  description: string;
  categoryCode: string | null; // null = citizen skipped the optional category
  categoryLabel: string | null;
  subdivisionCode: string | null;
  isAnonymous: boolean;
  submissionMode: 'text' | 'voice' | 'image';
  sourceLanguage: string | null;
  photos: WebpPhoto[];
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  locationStatus: string; // e.g. 'ready' | 'denied' | 'unavailable'
}

export interface DuplicateCluster {
  parentComplaintId: number;
  similarity: number;
}

export interface SubmitOutcome {
  ok: boolean;
  httpStatus?: number;
  serverError?: string;
  /** true when the request itself failed (offline / network drop / timeout). */
  networkError?: boolean;
  /** Set on success when the intake API linked the report to a duplicate. */
  cluster?: DuplicateCluster | null;
}

export interface CitizenIntakeFormProps {
  /** Optional custom submitter; defaults to a multipart POST to `apiEndpoint`. */
  onSubmit?: (payload: IntakePayload) => Promise<SubmitOutcome>;
  /** Route the default submitter posts to. */
  apiEndpoint?: string;
  /** Citizen id sent as `x-user-id` until real session auth exists. */
  userId?: string | number;
  maxPhotos?: number;
}

/* ----------------------------------------------------------------------------
 * Fixed category taxonomy (must mirror the Categories table seed)
 * -------------------------------------------------------------------------- */

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { code: 'AGR', label: 'Agriculture & Farmer Welfare' },
  { code: 'WAT', label: 'Water & Sanitation' },
  { code: 'HLT', label: 'Health & Wellness' },
  { code: 'EDU', label: 'Education & Skill Development' },
  { code: 'PWR', label: 'Energy & Electricity' },
  { code: 'INF', label: 'Roads & Infrastructure' },
  { code: 'SWM', label: 'Waste Management' },
  { code: 'OTH', label: 'Something else' },
];

const SUBDIVISION_OPTIONS: SubdivisionOption[] = [
  { code: 'AGR_IRR', name: 'Irrigation & Water Access', parentCode: 'AGR' },
  { code: 'AGR_CROP', name: 'Crops, Seeds & Subsidies', parentCode: 'AGR' },
  { code: 'WAT_SUP', name: 'Drinking Water Supply', parentCode: 'WAT' },
  { code: 'WAT_DRAIN', name: 'Drainage & Sewage', parentCode: 'WAT' },
  { code: 'HLT_FAC', name: 'Health Facilities', parentCode: 'HLT' },
  { code: 'HLT_MED', name: 'Medicines & Emergency Care', parentCode: 'HLT' },
  { code: 'EDU_SCH', name: 'Schools & Teachers', parentCode: 'EDU' },
  { code: 'EDU_AID', name: 'Scholarships & Student Services', parentCode: 'EDU' },
  { code: 'PWR_SUP', name: 'Electricity Supply', parentCode: 'PWR' },
  { code: 'PWR_LIGHT', name: 'Street Lighting', parentCode: 'PWR' },
  { code: 'INF_ROAD', name: 'Roads & Potholes', parentCode: 'INF' },
  { code: 'INF_BRIDGE', name: 'Bridges & Public Works', parentCode: 'INF' },
  { code: 'SWM_COLLECTION', name: 'Garbage Collection', parentCode: 'SWM' },
  { code: 'SWM_DUMP', name: 'Dumping & Cleanliness', parentCode: 'SWM' },
  { code: 'OTH_SERVICES', name: 'Other Citizen Services', parentCode: 'OTH' },
];

/* ----------------------------------------------------------------------------
 * Constants
 * -------------------------------------------------------------------------- */

const MAX_WEBP_BYTES = 500 * 1024; // strictly under 500 KB (499 KB max)
const MAX_PHOTOS_DEFAULT = 4;
const DEFAULT_API_ENDPOINT = '/api/complaints';
const REQUEST_TIMEOUT_MS = 20_000; // abort long-hanging uploads
const MIN_TITLE = 5;
const MAX_TITLE = 300;
const MIN_DESCRIPTION = 10;

type StepKey =
  | 'category'
  | 'subdivision'
  | 'title'
  | 'description'
  | 'photos'
  | 'privacy';

const STEP_ORDER: StepKey[] = [
  'category',
  'subdivision',
  'title',
  'description',
  'photos',
  'privacy',
];

const STEP_META: Record<
  StepKey,
  { question: string; hint?: string }
> = {
  title: {
    question: 'What would you like to report? Give it a short title.',
    hint: `${MIN_TITLE}–${MAX_TITLE} characters`,
  },
  description: {
    question: "Tell me more about what's happening.",
    hint: 'What did you see, where exactly, and since when?',
  },
  category: {
    question: 'Does it fit one of these categories?',
    hint: 'Start here so we can show more relevant reported problems.',
  },
  subdivision: {
    question: 'Which subdivision best matches the issue?',
    hint: 'Optional — choose the closest one.',
  },
  photos: {
    question: 'Add a photo as evidence?',
    hint: 'Up to 4 photos, compressed to WebP under 500 KB right in your browser. Photo storage must be configured by the deployment owner.',
  },
  privacy: {
    question: 'Should this report show your name publicly?',
  },
};

type Privacy = 'public' | 'anonymous';

const PRIVACY_LABEL: Record<Privacy, string> = {
  public: 'Public',
  anonymous: 'Anonymous',
};

const REVIEW_LABELS: Record<StepKey, string> = {
  category: 'Category',
  subdivision: 'Subdivision',
  title: 'Issue title',
  description: 'Description',
  photos: 'Evidence',
  privacy: 'Privacy',
};

function MicIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? 'text-rose-600' : 'text-green-700'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * Canvas / WebP compression utilities
 * -------------------------------------------------------------------------- */

function isWebpSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(`Could not read "${file.name}". It may be corrupted or not an image.`)
      );
    };
    image.src = url;
  });
}

/** Draws the source into a fresh canvas whose longest side <= maxDimension. */
function renderScaled(
  source: HTMLImageElement,
  maxDimension: number
): HTMLCanvasElement {
  const sourceWidth = source.naturalWidth || 1;
  const sourceHeight = source.naturalHeight || 1;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialise the image canvas.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

async function convertToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16_000;
    const frameCount = Math.ceil(decoded.duration * targetRate);
    const offline = new OfflineAudioContext(1, frameCount, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

/**
 * Resizes + re-encodes an image to WebP, iterating over quality and
 * dimensions until the result is strictly below 500 KB.
 */
export async function compressToWebp(
  file: File,
  maxBytes: number = MAX_WEBP_BYTES
): Promise<WebpPhoto> {
  if (!isWebpSupported()) {
    throw new Error(
      'WebP encoding is not supported in this browser. Please use a modern browser (Chrome, Edge, Firefox, or Safari 16+).'
    );
  }
  const source = await loadImage(file);

  let quality = 0.8;
  let maxDimension = 1600; // initial downscale for very large camera photos
  let blob: Blob | null = null;
  let width = 0;
  let height = 0;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const canvas = renderScaled(source, maxDimension);
    width = canvas.width;
    height = canvas.height;
    blob = await canvasToWebpBlob(canvas, quality);
    if (blob && blob.size < maxBytes) break;

    // Strategy: first squeeze quality, then start shrinking dimensions.
    if (quality > 0.4) {
      quality = Math.max(0.4, quality - 0.15);
    } else if (maxDimension > 240) {
      maxDimension = Math.max(240, Math.round(maxDimension * 0.75));
      quality = 0.72; // smaller canvases need less aggressive lossiness
    } else {
      break; // cannot shrink any further
    }
  }

  if (!blob || blob.size >= maxBytes) {
    throw new Error(
      `Could not compress "${file.name}" below 500 KB. Please try a smaller photo.`
    );
  }

  const baseName = file.name.replace(/\.[^.]+$/i, '') || 'photo';
  const webpFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  return {
    file: webpFile,
    previewUrl: URL.createObjectURL(webpFile),
    size: webpFile.size,
    width,
    height,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
}

function isDuplicateCluster(value: unknown): value is DuplicateCluster {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { parentComplaintId?: unknown; similarity?: unknown };
  return (
    typeof candidate.parentComplaintId === 'number' &&
    typeof candidate.similarity === 'number'
  );
}

/* ----------------------------------------------------------------------------
 * useGeolocation - silently fetches coordinates once on mount
 * -------------------------------------------------------------------------- */

type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; latitude: number; longitude: number; accuracy: number }
  | { status: 'denied' }
  | { status: 'unavailable'; error: string };

interface ReverseGeocodeResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; description?: string }>;
  };
}

function getResolvedPlace(data: ReverseGeocodeResponse): string | null {
  const administrative = data.localityInfo?.administrative ?? [];
  const city =
    data.city ??
    data.locality ??
    administrative.find((item) =>
      /city|town|municipality|village|district/i.test(
        `${item.name ?? ''} ${item.description ?? ''}`
      )
    )?.name;
  const state =
    data.principalSubdivision ??
    administrative.find((item) =>
      /state|province|region/i.test(`${item.name ?? ''} ${item.description ?? ''}`)
    )?.name;

  return city && state ? `${city}, ${state}` : city ?? state ?? null;
}

function useGeolocation() {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [place, setPlace] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeo({
        status: 'unavailable',
        error: 'Geolocation is not supported by this browser or context.',
      });
      return;
    }
    setGeo({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setGeo({
          status: 'ready',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeo({ status: 'denied' });
        } else {
          setGeo({ status: 'unavailable', error: error.message });
        }
      },
      // Silent single-shot grab on mount: no watch, low power profile.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }, []);

  // Auto-fetch on mount (the browser may still show its own permission prompt).
  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    if (geo.status !== 'ready') {
      setPlace(null);
      setPlaceError(null);
      return;
    }

    const controller = new AbortController();
    const lookup = async () => {
      try {
        setPlaceError(null);
        const mapplsResponse = await fetch(
          `/api/geocode?latitude=${geo.latitude}&longitude=${geo.longitude}`,
          { signal: controller.signal }
        );
        if (mapplsResponse.ok) {
          const mapplsData = (await mapplsResponse.json()) as { place?: unknown };
          if (typeof mapplsData.place === 'string' && mapplsData.place) {
            setPlace(mapplsData.place);
            return;
          }
        }

        // Keep the location hint useful when Mappls is unavailable or unconfigured.
        const fallbackResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${geo.latitude}&longitude=${geo.longitude}&localityLanguage=en`,
          { signal: controller.signal }
        );
        if (!fallbackResponse.ok) throw new Error(`Reverse geocoding returned ${fallbackResponse.status}.`);
        const fallbackData = (await fallbackResponse.json()) as ReverseGeocodeResponse;
        setPlace(getResolvedPlace(fallbackData));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPlace(null);
        setPlaceError('City and state could not be determined.');
      }
    };

    void lookup();
    return () => controller.abort();
  }, [geo]);

  return { geo, place, placeError, retry: locate };
}

/* ----------------------------------------------------------------------------
 * useOnline - tracks browser connectivity for PWA offline handling
 * -------------------------------------------------------------------------- */

function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

/* ----------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

type AnswerValue =
  | string
  | CategoryOption
  | SubdivisionOption
  | null
  | WebpPhoto[]
  | Privacy;

type Answers = Partial<Record<StepKey, AnswerValue>>;

export default function CitizenIntakeForm({
  onSubmit,
  apiEndpoint = DEFAULT_API_ENDPOINT,
  userId,
  maxPhotos = MAX_PHOTOS_DEFAULT,
}: CitizenIntakeFormProps) {
  /* ---- state ----------------------------------------------------------- */
  const { geo, place, placeError, retry: retryGeolocation } = useGeolocation();
  const isOnline = useOnline();

  const [answers, setAnswers] = useState<Answers>({});
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(CATEGORY_OPTIONS);
  const [subdivisions, setSubdivisions] =
    useState<SubdivisionOption[]>(SUBDIVISION_OPTIONS);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('hi');
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [similarComplaints, setSimilarComplaints] = useState<SimilarComplaint[]>([]);
  const [submittedSimilarComplaints, setSubmittedSimilarComplaints] = useState<
    SimilarComplaint[]
  >([]);
  const [loadingSubmittedSimilar, setLoadingSubmittedSimilar] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [relatedProblemsOpen, setRelatedProblemsOpen] = useState(false);
  const [distinctComplaint, setDistinctComplaint] = useState(false);
  const [pickedPhotos, setPickedPhotos] = useState<WebpPhoto[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateCluster | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upvoteNote, setUpvoteNote] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [upvotingComplaintId, setUpvotingComplaintId] = useState<number | null>(null);

  /* ---- refs ------------------------------------------------------------ */
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]); // preview URLs to revoke on unmount
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStartedFromInitialRef = useRef(false);

  // Always keep the newest chat content in view.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [
    answers,
    geo.status,
    processingPhotos,
    pickedPhotos.length,
    submitted,
    duplicate?.parentComplaintId,
    submitError,
    upvoteNote,
    isOnline,
    voting,
  ]);

  // Revoke every preview object URL we created when the component unmounts.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/categories')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { categories?: Array<{ code: string; name: string }>; subdivisions?: SubdivisionOption[] } | null) => {
        if (!active || !data) return;
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoryOptions(data.categories.map((item) => ({ code: item.code, label: item.name })));
        }
        if (Array.isArray(data.subdivisions) && data.subdivisions.length > 0) {
          setSubdivisions(
            data.subdivisions.map((item) => ({
              ...item,
              parentCode: item.parentCode.trim().toUpperCase(),
            }))
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const category = answers.category as CategoryOption | null | undefined;
    const text = `${draftTitle.trim()} ${draftDescription.trim()}`.trim();
    if (!category || distinctComplaint) {
      setSimilarComplaints([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingSimilar(true);
      try {
        const embedding =
          text.length >= MIN_DESCRIPTION
            ? await createComplaintEmbedding(text)
            : undefined;
        const response = await fetch('/api/complaints/similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, embedding, categoryCode: category.code }),
        });
        const data = (await response.json().catch(() => null)) as {
          complaints?: typeof similarComplaints;
        } | null;
        setSimilarComplaints(Array.isArray(data?.complaints) ? data.complaints : []);
      } catch {
        setSimilarComplaints([]);
      } finally {
        setLoadingSimilar(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [answers.category, distinctComplaint, draftDescription, draftTitle]);

  /* ---- derived step progression ---------------------------------------- */
  const answeredKeys = STEP_ORDER.filter((key) => answers[key] !== undefined);
  const currentKey: StepKey | null =
    STEP_ORDER.find((key) => answers[key] === undefined) ?? null;
  const allAnswered = currentKey === null;
  const stepProgress = answeredKeys.length;

  // Reset the text drafts whenever the conversation moves to a text step.
  useEffect(() => {
    if (currentKey === 'title') setDraftTitle('');
    if (currentKey === 'description') setDraftDescription('');
  }, [currentKey]);

  /* ---- step answer handlers -------------------------------------------- */
  const commitTitle = () => {
    const title = draftTitle.trim();
    if (title.length < MIN_TITLE || title.length > MAX_TITLE) return;
    setAnswers((prev) => ({ ...prev, title }));
    setDraftTitle('');
  };

  const commitDescription = () => {
    const description = draftDescription.trim();
    if (description.length < MIN_DESCRIPTION) return;
    setAnswers((prev) => ({ ...prev, description }));
    setDraftDescription('');
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const recording = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          const blob = await convertToWav(recording);
          const buffer = await blob.arrayBuffer();
          const audio = arrayBufferToBase64(buffer);
          const response = await fetch('/api/bhashini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio,
              sourceLanguage: voiceLanguage,
            }),
          });
          const data = (await response.json().catch(() => null)) as {
            transcript?: string;
            error?: string;
          } | null;
          if (!response.ok || !data?.transcript) {
            throw new Error(data?.error ?? `Transcription failed (HTTP ${response.status}).`);
          }
          setVoiceUsed(true);
          if (voiceStartedFromInitialRef.current) {
            const transcript = data.transcript.trim();
            const firstSentence = transcript.split(/[.!?]\s+/)[0]?.trim() ?? transcript;
            setAnswers((current) => ({
              ...current,
              title: (firstSentence || 'Voice complaint').slice(0, MAX_TITLE),
            }));
            voiceStartedFromInitialRef.current = false;
          }
          setDraftDescription((current) =>
            current.trim() ? `${current.trim()} ${data.transcript}` : data.transcript ?? ''
          );
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : 'Could not transcribe the recording.');
        } finally {
          setTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceError('Microphone permission was denied or unavailable.');
    }
  };

  const startVoiceIntake = () => {
    voiceStartedFromInitialRef.current = true;
    setAnswers((current) => ({
      ...current,
      category: null,
      subdivision: null,
      title: 'Voice complaint',
    }));
    setTimeout(() => void toggleRecording(), 0);
  };

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    },
    []
  );

  const chooseCategory = (option: CategoryOption) => {
    setAnswers((prev) => ({ ...prev, category: option, subdivision: undefined }));
  };

  const skipCategory = () => {
    setAnswers((prev) => ({ ...prev, category: null, subdivision: null }));
  };

  const chooseSubdivision = (option: SubdivisionOption) => {
    setAnswers((prev) => ({ ...prev, subdivision: option }));
  };

  const skipSubdivision = () => {
    setAnswers((prev) => ({ ...prev, subdivision: null }));
  };

  const choosePrivacy = (privacy: Privacy) => {
    setAnswers((prev) => ({ ...prev, privacy }));
  };

  const finishPhotos = () => {
    if (pickedPhotos.length === 0) return;
    setAnswers((prev) => ({ ...prev, photos: pickedPhotos }));
  };

  const skipPhotos = () => {
    setAnswers((prev) => ({ ...prev, photos: null }));
  };

  /** Pull a step back to the front of the conversation to re-answer it. */
  const editAnswer = (key: StepKey) => {
    // Restore already-picked photos so re-answering the step can resume them.
    if (key === 'photos') {
      const old = answers.photos;
      setPickedPhotos(Array.isArray(old) ? old : []);
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /* ---- photo picking + compression -------------------------------------- */
  const handlePickPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-selecting the same file
    if (picked.length === 0) return;

    if (pickedPhotos.length + picked.length > maxPhotos) {
      setPhotoError(`You can attach up to ${maxPhotos} photos.`);
      return;
    }

    setPhotoError(null);
    setProcessingPhotos(true);
    try {
      for (const file of picked) {
        try {
          const photo = await compressToWebp(file);
          objectUrlsRef.current.push(photo.previewUrl);
          setPickedPhotos((prev) => [...prev, photo]);
        } catch (error) {
          setPhotoError(
            error instanceof Error ? error.message : 'Photo compression failed.'
          );
        }
      }
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    setPickedPhotos((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
  };

  /* ---- submission -------------------------------------------------------- */
  const buildPayload = (): IntakePayload | null => {
    if (!allAnswered) return null;
    const title = answers.title;
    const description = answers.description;
    if (typeof title !== 'string' || typeof description !== 'string') return null;

    const category = answers.category as CategoryOption | null | undefined;
    const subdivision = answers.subdivision as SubdivisionOption | null | undefined;
    const privacy = answers.privacy as Privacy | undefined;
    const photos = (answers.photos as WebpPhoto[] | null | undefined) ?? [];
    const coordsReady = geo.status === 'ready';

    return {
      title: title.trim(),
      description: description.trim(),
      categoryCode: category?.code ?? null,
      categoryLabel: category?.label ?? null,
      subdivisionCode: subdivision?.code ?? null,
      isAnonymous: privacy === 'anonymous',
      submissionMode: voiceUsed ? 'voice' : photos.length > 0 ? 'image' : 'text',
      sourceLanguage: voiceUsed ? voiceLanguage : null,
      photos,
      latitude: coordsReady ? geo.latitude : null,
      longitude: coordsReady ? geo.longitude : null,
      locationAccuracyM: coordsReady ? Math.round(geo.accuracy) : null,
      locationStatus: geo.status,
    };
  };

  /**
   * Default submitter: multipart POST to `apiEndpoint` with the fields the
   * intake route expects (title, description, categoryCode, privacy,
   * latitude/longitude, and the pre-compressed WebP photos).
   */
  const defaultSubmit = async (
    payload: IntakePayload
  ): Promise<SubmitOutcome> => {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('categoryCode', payload.categoryCode ?? '');
    if (payload.subdivisionCode) formData.append('subdivisionCode', payload.subdivisionCode);
    formData.append('privacy', payload.isAnonymous ? 'anonymous' : 'public');
    formData.append('distinctComplaint', distinctComplaint ? 'true' : 'false');
    try {
      const embedding = await createComplaintEmbedding(`${payload.title}. ${payload.description}`);
      formData.append('embedding', JSON.stringify(embedding));
    } catch (error) {
      console.warn('Browser embedding unavailable; the server will use its configured fallback.', error);
    }
    formData.append('submissionMode', payload.submissionMode);
    if (payload.sourceLanguage) formData.append('sourceLanguage', payload.sourceLanguage);
    if (payload.latitude !== null && payload.longitude !== null) {
      formData.append('latitude', String(payload.latitude));
      formData.append('longitude', String(payload.longitude));
    }
    // Append every compressed WebP file under the 'photos' field name.
    payload.photos.forEach((photo) => {
      formData.append('photos', photo.file, photo.file.name);
    });

    // Demo identity until real session auth replaces the x-user-id header.
    const headers: Record<string, string> = {};
    if (userId !== undefined && userId !== null) {
      headers['x-user-id'] = String(userId);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers,
          body: formData, // multipart/form-data boundary is set automatically
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        cluster?: unknown;
      } | null;

      if (!response.ok) {
        return {
          ok: false,
          httpStatus: response.status,
          serverError:
            data?.error ?? `Submission failed (HTTP ${response.status}).`,
        };
      }

      // Surface the semantic duplicate cluster, when the API found one.
      const clusterValue: unknown = data?.cluster;
      return {
        ok: true,
        cluster: isDuplicateCluster(clusterValue) ? clusterValue : null,
      };
    } catch {
      // fetch rejects on offline / network drops / abort (timeout).
      return { ok: false, networkError: true };
    }
  };

  const submitIntake = (payload: IntakePayload): Promise<SubmitOutcome> =>
    onSubmit ? onSubmit(payload) : defaultSubmit(payload);

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload || submitting) return;

    if (!isOnline) {
      setSubmitError(
        "You're offline. Reconnect and press retry — nothing you typed is lost."
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setDuplicate(null);
    setUpvoteNote(null);

    const outcome = await submitIntake(payload);
    setSubmitting(false);

    if (!outcome.ok) {
      if (outcome.networkError) {
        setSubmitError(
          "We couldn't reach the server — your connection may have dropped. Your report is still here; press retry once you're back online."
        );
      } else {
        setSubmitError(
          outcome.serverError ?? `Submission failed (HTTP ${outcome.httpStatus}).`
        );
      }
      return;
    }

    if (outcome.cluster) {
      // Wait for the citizen's decision before showing the success screen.
      setDuplicate(outcome.cluster);
    } else {
      void loadSubmittedSimilarComplaints(payload);
      setSubmitted(true);
    }
  };

  const loadSubmittedSimilarComplaints = async (payload: IntakePayload) => {
    setLoadingSubmittedSimilar(true);
    try {
      const embedding = await createComplaintEmbedding(`${payload.title}. ${payload.description}`);
      const response = await fetch('/api/complaints/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${payload.title}. ${payload.description}`,
          embedding,
          categoryCode: payload.categoryCode,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        complaints?: SimilarComplaint[];
      } | null;
      setSubmittedSimilarComplaints(
        Array.isArray(data?.complaints)
          ? data.complaints.filter((complaint) => complaint.similarity >= 0.65)
          : []
      );
    } catch {
      setSubmittedSimilarComplaints([]);
    } finally {
      setLoadingSubmittedSimilar(false);
    }
  };

  /** Citizen keeps their report; it is already linked to the duplicate. */
  const keepMyReport = () => {
    if (duplicate) {
      setUpvoteNote(
        `Your report was linked to earlier report #${duplicate.parentComplaintId} — both will be resolved together.`
      );
    }
    setDuplicate(null);
    setSubmitted(true);
  };

  /** Citizen upvotes the earlier report (best-effort until that route exists). */
  const handleUpvoteInstead = async () => {
    if (!duplicate || voting) return;
    setVoting(true);
    setUpvoteNote(null);

    const headers: Record<string, string> = {};
    if (userId !== undefined && userId !== null) {
      headers['x-user-id'] = String(userId);
    }
    try {
      const response = await fetch(
        `${apiEndpoint}/${duplicate.parentComplaintId}/upvote`,
        { method: 'POST', headers }
      );
      if (response.ok) {
        setUpvoteNote(
          `Thanks! Your upvote was recorded on report #${duplicate.parentComplaintId}.`
        );
      } else {
        setUpvoteNote(
          `Upvoting isn't available yet (HTTP ${response.status}). Your report is still linked to #${duplicate.parentComplaintId} and both will be resolved together.`
        );
      }
    } catch {
      setUpvoteNote(
        `You appear to be offline. Your report is still linked to #${duplicate.parentComplaintId} — retry the upvote once you're back online.`
      );
    } finally {
      setVoting(false);
      setDuplicate(null);
      setSubmitted(true);
    }
  };

  const handleUpvoteComplaint = async (complaintId: number) => {
    if (upvotingComplaintId !== null || !isOnline) return;
    setUpvotingComplaintId(complaintId);
    try {
      await fetch(`${apiEndpoint}/${complaintId}/upvote`, {
        method: 'POST',
        headers: userId === undefined ? {} : { 'x-user-id': String(userId) },
      });
    } finally {
      setUpvotingComplaintId(null);
    }
  };

  const resetForm = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPickedPhotos([]);
    setAnswers({});
    setPhotoError(null);
    setSubmitError(null);
    setDuplicate(null);
    setUpvoteNote(null);
    setSubmittedSimilarComplaints([]);
    setLoadingSubmittedSimilar(false);
    setRelatedProblemsOpen(false);
    setSubmitted(false);
  };

  /* ---- render helpers ----------------------------------------------------- */

  const geoPill = (() => {
    switch (geo.status) {
      case 'ready':
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
            📍 {place ? `Reported from ${place}` : 'Location captured'}
            {!place && !placeError && <span>(finding city and state…)</span>}
            {placeError && <span>({placeError})</span>}
          </span>
        );
      case 'locating':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-indigo-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            Detecting location…
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
            📍 Location blocked
            <button
              type="button"
              onClick={retryGeolocation}
              className="font-semibold text-amber-900 underline underline-offset-2"
            >
              Allow
            </button>
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            📍 Location unavailable
            <button
              type="button"
              onClick={retryGeolocation}
              className="font-semibold text-slate-800 underline underline-offset-2"
            >
              Retry
            </button>
          </span>
        );
      default:
        return null;
    }
  })();

  const renderAnswerContent = (key: StepKey) => {
    const value = answers[key];
    switch (key) {
      case 'title':
      case 'description':
        return (
          <p className="whitespace-pre-wrap break-words">{String(value)}</p>
        );
      case 'category': {
        const category = value as CategoryOption | null;
        return category ? (
          <p>{category.label}</p>
        ) : (
          <p className="italic opacity-70">Skipped — left for AI triage</p>
        );
      }
      case 'subdivision': {
        const subdivision = value as SubdivisionOption | null;
        return subdivision ? <p>{subdivision.name}</p> : <p className="italic opacity-70">Skipped</p>;
      }
      case 'photos': {
        const photos = value as WebpPhoto[] | null;
        if (!photos || photos.length === 0) {
          return (
            <p className="italic opacity-70">
              {photos ? 'No photos attached' : 'Skipped — no photos'}
            </p>
          );
        }
        const totalBytes = photos.reduce((sum, p) => sum + p.size, 0);
        return (
          <div>
            <p>
              {photos.length} photo{photos.length > 1 ? 's' : ''} ·{' '}
              {formatBytes(totalBytes)} total
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo) => (
                <img
                  key={photo.previewUrl}
                  src={photo.previewUrl}
                  alt="Attached evidence"
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10"
                />
              ))}
            </div>
          </div>
        );
      }
      case 'privacy': {
        const privacy = value as Privacy;
        return (
          <p>
            {privacy === 'anonymous' ? '🕶️ Anonymous' : '🙂 Public'}{' '}
            <span className="opacity-75">· {PRIVACY_LABEL[privacy]}</span>
          </p>
        );
      }
      default:
        return null;
    }
  };

  const renderControlsForStep = (key: StepKey) => {
    switch (key) {
      case 'category':
        return (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {categoryOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => chooseCategory(option)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:scale-[0.98]"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={skipCategory}
              className="mt-3 text-sm font-medium text-slate-500 underline underline-offset-2"
            >
              Skip for now →
            </button>
            <button
              type="button"
              onClick={startVoiceIntake}
              disabled={recording || transcribing}
              aria-label="Start voice input"
              title="Start voice input"
              className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-200 bg-green-50 transition-all hover:bg-green-100 disabled:opacity-50"
            >
              <MicIcon />
            </button>
          </div>
        );
      case 'subdivision': {
        const category = answers.category as CategoryOption | null | undefined;
        const categoryCode = category?.code?.trim().toUpperCase();
        const options = subdivisions.filter(
          (item) => item.parentCode.trim().toUpperCase() === categoryCode
        );
        if (options.length === 0) {
          return (
            <div className="mt-3">
              <button
                type="button"
                onClick={skipSubdivision}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Continue →
              </button>
            </div>
          );
        }
        return (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {options.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => chooseSubdivision(option)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-green-300 hover:bg-green-50 hover:shadow-md active:scale-[0.98]"
                >
                  {option.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={skipSubdivision}
              className="mt-3 text-sm font-medium text-slate-500 underline underline-offset-2"
            >
              Skip for now →
            </button>
          </div>
        );
      }
      case 'photos':
        return (
          <div className="mt-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md active:scale-[0.98]">
                📷 {pickedPhotos.length > 0 ? 'Add more photos' : 'Attach a photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={handlePickPhotos}
                  disabled={processingPhotos || pickedPhotos.length >= maxPhotos}
                />
              </label>
              {processingPhotos && (
                <span className="text-sm text-slate-500">
                  Compressing to WebP…
                </span>
              )}
            </div>

            {photoError && (
              <p className="mt-2 text-xs font-medium text-rose-600">{photoError}</p>
            )}

            {pickedPhotos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pickedPhotos.map((photo) => (
                  <div
                    key={photo.previewUrl}
                    className="group relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-black/10"
                  >
                    <img
                      src={photo.previewUrl}
                      alt="Selected"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] font-semibold text-white">
                      {formatBytes(photo.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.previewUrl)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white transition hover:bg-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-4 text-sm font-medium">
              <button
                type="button"
                onClick={finishPhotos}
                disabled={pickedPhotos.length === 0 || processingPhotos}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pickedPhotos.length > 0 ? 'Done — send photos' : 'Done'}
              </button>
              <button
                type="button"
                onClick={skipPhotos}
                className="text-slate-500 underline underline-offset-2"
              >
                No photos →
              </button>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => choosePrivacy('public')}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:scale-[0.98]"
            >
              <span className="text-2xl">🙂</span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Public
                </span>
                <span className="block text-xs text-slate-500">
                  Your name is visible with the report
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => choosePrivacy('anonymous')}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:scale-[0.98]"
            >
              <span className="text-2xl">🕶️</span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Anonymous
                </span>
                <span className="block text-xs text-slate-500">
                  Your identity stays hidden from the public
                </span>
              </span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const textStepActive = currentKey === 'title' || currentKey === 'description';
  const titleValid =
    draftTitle.trim().length >= MIN_TITLE && draftTitle.trim().length <= MAX_TITLE;
  const descriptionValid = draftDescription.trim().length >= MIN_DESCRIPTION;

  const bubble = (from: 'assistant' | 'user', children: ReactNode) => (
    <div
      className={`flex w-full ${from === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`flex max-w-[86%] items-end gap-2 ${from === 'user' ? 'flex-row-reverse' : ''}`}
      >
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm shadow-sm ${
            from === 'user' ? 'bg-indigo-100' : 'bg-slate-200'
          }`}
        >
          {from === 'user' ? '🧑' : '🏛️'}
        </span>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            from === 'user'
              ? 'rounded-br-md bg-indigo-600 text-white'
              : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  /* ------------------------------------------------------------------------ */
  return (
    <div className="flex h-[100dvh] flex-col bg-[#f8fafc]">
      {/* ---- header ---- */}
      <header className="border-b border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400">← Back</p>
            <h1 className="mt-1 truncate text-base font-bold tracking-tight text-slate-950">
              New Community Report
            </h1>
            <p className="text-xs text-slate-500">
              Step {Math.min(stepProgress + 1, STEP_ORDER.length)} of {STEP_ORDER.length}
            </p>
          </div>
          <span className="rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 ring-1 ring-green-100">
            Civic Portal
          </span>
        </div>
        {/* progress dots */}
        <div className="mx-auto mt-3 flex w-full max-w-3xl gap-1.5">
          {STEP_ORDER.map((key) => {
            const done = answers[key] !== undefined;
            const active = key === currentKey;
            return (
              <span
                key={key}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  done
                    ? 'bg-indigo-500'
                    : active
                      ? 'bg-indigo-300'
                      : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>
        <div className="mx-auto mt-2 flex w-full max-w-3xl justify-end">{geoPill}</div>
      </header>

      {/* ---- offline banner (PWA) ---- */}
      {!isOnline && (
        <div className="border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-800">
          📡 You're offline — reports will wait until you reconnect. Your
          answers are safe.
        </div>
      )}

      {/* ---- chat transcript ---- */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          {bubble(
            'assistant',
            <p>
              Welcome. Tell us what is happening in your community and we&apos;ll route it
              to the right team. This takes less than a minute.
            </p>
          )}

          {answeredKeys.map((key) => (
            <Fragment key={key}>
              {bubble('assistant', <p>{STEP_META[key].question}</p>)}
              {bubble('user', renderAnswerContent(key))}
            </Fragment>
          ))}

          {currentKey && (
            <Fragment key={currentKey}>
              {bubble(
                'assistant',
                <div>
                  <p>{STEP_META[currentKey].question}</p>
                  {STEP_META[currentKey].hint && (
                    <p className="mt-1 text-xs text-slate-400">
                      {STEP_META[currentKey].hint}
                    </p>
                  )}
                  {renderControlsForStep(currentKey)}
                </div>
              )}
            </Fragment>
          )}

          {/* ---- review + submit card ---- */}
          {allAnswered && !submitted && !duplicate && (
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-lg shadow-slate-200/50 backdrop-blur-md">
              <h2 className="text-sm font-bold text-slate-900">
                Review &amp; submit
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Location: {geo.status === 'ready' ? 'auto-detected ✓' : 'not available'}
              </p>
              <dl className="mt-3 divide-y divide-slate-100">
                {STEP_ORDER.map((key) => (
                  <div key={key} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {REVIEW_LABELS[key]}
                      </dt>
                      <dd className="mt-0.5 truncate text-sm text-slate-800">
                        {renderAnswerContent(key)}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => editAnswer(key)}
                      className="shrink-0 text-xs font-semibold text-indigo-700 underline underline-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </dl>

              {geo.status === 'denied' && (
                <p className="mt-1 text-xs text-amber-600">
                  Location permission is blocked, so the report won't include
                  coordinates. You can{' '}
                  <button
                    type="button"
                    onClick={retryGeolocation}
                    className="font-semibold underline underline-offset-2"
                  >
                    try allowing it again
                  </button>
                  .
                </p>
              )}

              {submitError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <span>{submitError}</span>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="ml-2 font-bold underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!isOnline && (
                <p className="mt-2 text-xs text-amber-600">
                  Waiting for a connection before submitting…
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !isOnline}
                className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit report →'}
              </button>
            </div>
          )}

          {/* ---- semantic duplicate notice ---- */}
          {duplicate && !submitted && (
            <div
              role="status"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-amber-900">
                A similar issue has already been reported nearby. Would you like
                to upvote it instead?
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Your report was stored and linked to report #{duplicate.parentComplaintId} (
                {Math.round(duplicate.similarity * 100)}% similar) — either way it will be
                resolved together with the earlier one.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleUpvoteInstead}
                  disabled={voting || !isOnline}
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {voting ? 'Recording…' : '👍 Yes, upvote the earlier report'}
                </button>
                <button
                  type="button"
                  onClick={keepMyReport}
                  disabled={voting}
                  className="rounded-full border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  No, keep my report
                </button>
              </div>
              {!isOnline && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  You're offline — reconnect to upvote, or keep your report.
                </p>
              )}
            </div>
          )}

          {/* ---- success ---- */}
          {submitted && (
            <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5 text-center shadow-sm">
              <p className="text-3xl">🎉</p>
              <h2 className="mt-2 text-base font-bold text-teal-900">
                Report submitted!
              </h2>
              {upvoteNote && (
                <p className="mt-1 text-xs font-medium text-teal-800">
                  {upvoteNote}
                </p>
              )}
              <p className="mt-1 text-sm text-teal-800">
                You'll get an email alert at every step of the resolution.
              </p>
              {(loadingSubmittedSimilar || submittedSimilarComplaints.length > 0) && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">
                    Similar reports in your community
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Read related reports and support one that describes the same issue.
                  </p>
                  {loadingSubmittedSimilar ? (
                    <p className="mt-3 text-xs text-slate-400">Finding related reports…</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {submittedSimilarComplaints.map((complaint) => (
                        <details
                          key={complaint.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                            {complaint.title}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              {Math.round(complaint.similarity * 100)}% similar
                            </span>
                          </summary>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {complaint.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleUpvoteComplaint(complaint.id)}
                            disabled={
                              upvotingComplaintId !== null ||
                              !isOnline
                            }
                            className="mt-3 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {upvotingComplaintId === complaint.id
                              ? 'Saving…'
                              : '👍 Support this report'}
                          </button>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="mt-4 rounded-xl border border-teal-300 bg-white px-5 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
              >
                Report another issue
              </button>
            </div>
          )}

            <div ref={chatEndRef} />
          </div>

          {answers.category && !submitted && (
            <>
              <button
                type="button"
                onClick={() => setRelatedProblemsOpen((open) => !open)}
                aria-expanded={relatedProblemsOpen}
                className="fixed bottom-24 right-4 z-30 rounded-full border border-green-200 bg-white px-4 py-2.5 text-xs font-bold text-green-800 shadow-lg shadow-slate-900/10 transition hover:bg-green-50 lg:bottom-6 lg:right-8 xl:left-[calc(50%+20rem)] xl:right-auto"
              >
                {relatedProblemsOpen ? 'Hide related problems' : 'Related problems'}
                {similarComplaints.length > 0 && (
                  <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
                    {similarComplaints.length}
                  </span>
                )}
              </button>
              {relatedProblemsOpen && (
            <aside className="fixed bottom-36 right-4 z-30 max-h-[min(70vh,34rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/15 before:absolute before:-bottom-2 before:right-8 before:h-5 before:w-5 before:rotate-45 before:border-b before:border-r before:border-slate-200 before:bg-white lg:bottom-20 lg:right-8 xl:left-[calc(50%+20rem)] xl:right-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Related problems</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Suggestions update as you add more details.
                  </p>
                </div>
                <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                  Live
                </span>
              </div>

              {loadingSimilar ? (
                <p className="mt-4 text-xs text-slate-400">Curating related reports…</p>
              ) : similarComplaints.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  No related reports found yet. Keep describing the issue and we&apos;ll
                  refine the suggestions.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {similarComplaints.map((complaint, index) => (
                    <details
                      key={complaint.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      open={index === 0}
                    >
                      <summary className="cursor-pointer list-none text-xs font-semibold text-slate-800">
                        <span className="mr-2 text-slate-400">{index + 1}.</span>
                        {complaint.title}
                        <span className="mt-1 block text-[10px] font-normal text-slate-400">
                          {complaint.similarity > 0
                            ? `${Math.round(complaint.similarity * 100)}% similar`
                            : 'Same category'}
                        </span>
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {complaint.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleUpvoteComplaint(complaint.id)}
                        disabled={upvotingComplaintId !== null || !isOnline}
                        className="mt-3 w-full rounded-full bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {upvotingComplaintId === complaint.id
                          ? 'Saving…'
                          : '👍 Support this report'}
                      </button>
                    </details>
                  ))}
                </div>
              )}
            </aside>
              )}
            </>
          )}
        </div>
      </main>

      {/* ---- composer (only for free-text steps) ---- */}
      {textStepActive && !submitted && (
        <footer className="border-t border-slate-200 bg-white/90 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
          <div className="mx-auto w-full max-w-xl">
            {currentKey === 'title' ? (
              <div>
                <div className="flex items-end gap-2">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === 'Enter' && titleValid) {
                        event.preventDefault();
                        commitTitle();
                      }
                    }}
                    maxLength={MAX_TITLE}
                    placeholder="e.g. Water pipeline leaking for a week"
                    autoFocus
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={commitTitle}
                    disabled={!titleValid}
                    className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-1 pl-1 text-xs text-slate-400">
                  {draftTitle.trim().length}/{MAX_TITLE} ·{' '}
                  {draftTitle.trim().length > 0 &&
                  draftTitle.trim().length < MIN_TITLE
                    ? `at least ${MIN_TITLE} characters`
                    : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={voiceLanguage}
                    onChange={(event) => setVoiceLanguage(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs"
                    aria-label="Voice language"
                  >
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                    <option value="bn">Bengali</option>
                    <option value="ta">Tamil</option>
                  </select>
                  <button
                    type="button"
                    onClick={startVoiceIntake}
                    disabled={recording || transcribing}
                    aria-label="Start voice input"
                    title="Start voice input"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-green-50 transition hover:bg-green-100 disabled:opacity-50"
                  >
                    <MicIcon />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Or speak your complaint and we&apos;ll fill in the details.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    rows={3}
                    placeholder="Describe the issue…"
                    autoFocus
                    className="max-h-40 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                  <button
                    type="button"
                    onClick={commitDescription}
                    disabled={!descriptionValid}
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={voiceLanguage}
                    onChange={(event) => setVoiceLanguage(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs"
                    aria-label="Voice language"
                  >
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                    <option value="bn">Bengali</option>
                    <option value="ta">Tamil</option>
                  </select>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={transcribing}
                    aria-label={recording ? 'Stop voice input' : 'Start voice input'}
                    title={recording ? 'Stop voice input' : 'Start voice input'}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50 ${
                      recording
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-green-200 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    <MicIcon active={recording} />
                  </button>
                </div>
                {loadingSimilar && (
                  <p className="mt-2 text-xs text-slate-400">Looking for related reported problems…</p>
                )}
                {similarComplaints.length > 0 && (
                  <details className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-800">
                      {similarComplaints.length} related problem{similarComplaints.length > 1 ? 's' : ''} found
                    </summary>
                    <div className="mt-2 space-y-2">
                      {similarComplaints.map((complaint) => (
                        <details key={complaint.id} className="rounded-lg bg-white p-2 text-xs">
                          <summary className="cursor-pointer font-semibold text-slate-800">
                            #{complaint.id} {complaint.title} · {Math.round(complaint.similarity * 100)}% related
                          </summary>
                          <p className="mt-1 text-slate-600">{complaint.description}</p>
                        </details>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setDistinctComplaint(true);
                          setSimilarComplaints([]);
                        }}
                        className="text-xs font-semibold text-indigo-700 underline underline-offset-2"
                      >
                        None match — create a distinct complaint
                      </button>
                    </div>
                  </details>
                )}
                {distinctComplaint && (
                  <p className="mt-2 text-xs font-medium text-indigo-700">
                    This will be submitted as a new, distinct complaint.
                  </p>
                )}
                {voiceError && <p className="mt-1 text-xs text-red-600">{voiceError}</p>}
                <p className="mt-1 pl-1 text-xs text-slate-400">
                  {draftDescription.trim().length > 0 &&
                  draftDescription.trim().length < MIN_DESCRIPTION
                    ? `at least ${MIN_DESCRIPTION} characters`
                    : 'Press Send when you are done.'}
                </p>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
