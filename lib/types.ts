// Minimal hand-written Database type. In a real project generate this with
// `supabase gen types typescript --linked > lib/db.types.ts` and re-export.

export type Role = 'owner' | 'editor' | 'viewer';
export type Gender = 'male' | 'female' | 'other' | 'unspecified';
export type MilkType = 'breast' | 'formula' | 'mixed' | 'solid' | 'other';
export type StoolSize = 'small' | 'medium' | 'large';
export type OcrStatus = 'pending' | 'processing' | 'extracted' | 'reviewed' | 'confirmed' | 'failed';
export type FileKind =
  | 'prescription' | 'report' | 'stool_image' | 'daily_note' | 'other'
  | 'admission_report' | 'discharge_report' | 'lab_report'
  | 'ultrasound' | 'prenatal_lab' | 'maternal_vitals' | 'genetic_screening' | 'birth_plan';
export type NotificationKind =
  | 'medication_due'
  | 'medication_missed'
  | 'low_ocr_confidence'
  | 'file_ready'
  | 'feeding_alert'
  | 'stool_alert';

export interface Baby {
  id: string;
  name: string;
  dob: string;
  gender: Gender;
  birth_weight_kg: number | null;
  birth_height_cm: number | null;
  feeding_factor_ml_per_kg_per_day: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Feeding {
  id: string;
  baby_id: string;
  feeding_time: string;
  milk_type: MilkType;
  quantity_ml: number | null;
  kcal: number | null;
  duration_min: number | null;
  notes: string | null;
  source: 'manual' | 'ocr' | 'import';
  source_file_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StoolLog {
  id: string;
  baby_id: string;
  stool_time: string;
  quantity_category: StoolSize | null;
  quantity_ml: number | null;
  color: string | null;
  consistency: string | null;
  has_diaper_rash: boolean;
  notes: string | null;
  source: 'manual' | 'ocr' | 'import';
  source_file_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Medication {
  id: string;
  baby_id: string;
  name: string;
  dosage: string | null;
  route: 'oral' | 'topical' | 'inhaled' | 'nasal' | 'rectal' | 'injection' | 'other';
  frequency_hours: number | null;
  total_doses: number | null;
  starts_at: string;
  ends_at: string | null;
  prescribed_by: string | null;
  notes: string | null;
  file_id: string | null;
  deleted_at: string | null;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  baby_id: string;
  medication_time: string;
  status: 'taken' | 'missed' | 'skipped';
  actual_dosage: string | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface Measurement {
  id: string;
  baby_id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  head_circ_cm: number | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface MedicalFile {
  id: string;
  baby_id: string;
  kind: FileKind;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_handwritten: boolean | null;
  uploaded_by: string;
  uploaded_at: string;
  ocr_status: OcrStatus;
  notes: string | null;
  deleted_at: string | null;
}

export interface ExtractedText {
  id: string;
  file_id: string;
  baby_id: string;
  provider: 'anthropic' | 'google' | 'textract' | 'tesseract' | 'manual';
  model: string | null;
  raw_text: string | null;
  structured_data: StructuredOcr;
  confidence_score: number | null;
  is_handwritten: boolean | null;
  detected_language: string | null;
  flag_low_confidence: boolean;
  status: 'extracted' | 'reviewed' | 'confirmed' | 'discarded';
  reviewed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface StructuredOcr {
  feedings?:        { feeding_time?: string; quantity_ml?: number; milk_type?: MilkType; notes?: string }[];
  stools?:          { stool_time?: string; quantity_category?: StoolSize; quantity_ml?: number; color?: string; consistency?: string; notes?: string }[];
  measurements?:    { measured_at?: string; weight_kg?: number; height_cm?: number; head_circ_cm?: number; notes?: string }[];
  medication_logs?: { medication_id?: string; medication_time?: string; status?: 'taken'|'missed'|'skipped'; notes?: string }[];
  ultrasounds?: {
    scanned_at?: string;
    gestational_week?: number;
    gestational_day?: number;
    bpd_mm?: number;
    hc_mm?: number;
    ac_mm?: number;
    fl_mm?: number;
    efw_g?: number;
    fhr_bpm?: number;
    placenta_position?: string;
    amniotic_fluid?: string;
    sex_predicted?: 'male' | 'female' | 'undetermined';
    anomalies?: string;
    summary?: string;
  }[];
  notes?: string;
}

export interface Notification {
  id: string;
  baby_id: string;
  user_id: string | null;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface FeedingKpis {
  total_feed_ml: number;
  avg_feed_ml: number;
  feed_count: number;
  recommended_feed_ml: number;
  remaining_feed_ml: number;
  feeding_percentage: number;
}

export interface StoolKpis {
  stool_count: number;
  total_ml: number;
  small_count: number;
  medium_count: number;
  large_count: number;
  last_stool_at: string | null;
}

export interface MedicationKpis {
  total_doses: number;
  taken: number;
  missed: number;
  remaining: number;
  adherence_pct: number;
}

// Supabase Database type. Shallow shape for now — full typed schema can be
// generated with `supabase gen types typescript --linked > lib/db.types.ts`.
// We use `any` rather than `unknown` for Row/Args/Returns so supabase-js's
// generic inference (GetResult) doesn't collapse our select() results to
// `never` in strict mode. The app-level types above (Baby, Feeding, etc.)
// give back the real shape where we need it.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Database {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
    Views:  Record<string, { Row: any }>;
    Functions: Record<string, { Args: any; Returns: any }>;
  };
}
