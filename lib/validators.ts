import { z } from 'zod';

export const FeedingSchema = z.object({
  feeding_time: z.string().min(1),                  // ISO
  milk_type: z.enum(['breast','formula','mixed','solid','other']),
  quantity_ml: z.coerce.number().min(0).max(2000).nullable().optional(),
  kcal: z.coerce.number().min(0).max(5000).nullable().optional(),
  duration_min: z.coerce.number().min(0).max(600).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  // Every feeding must carry either a quantity (ml) or a duration (min) or a
  // note. Reject empty-shell entries that pollute analytics.
  v => (v.quantity_ml != null && v.quantity_ml > 0)
    || (v.duration_min != null && v.duration_min > 0)
    || (v.notes && v.notes.trim().length > 0),
  { message: 'Enter a quantity in ml, a duration in minutes, or a note.' }
);

export const StoolSchema = z.object({
  stool_time: z.string().min(1),
  quantity_category: z.enum(['small','medium','large']).nullable().optional(),
  quantity_ml: z.coerce.number().min(0).max(1000).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  consistency: z.string().max(40).nullable().optional(),
  has_diaper_rash: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const MeasurementSchema = z.object({
  measured_at: z.string().min(1),
  weight_kg: z.coerce.number().min(0).max(40).nullable().optional(),
  height_cm: z.coerce.number().min(0).max(200).nullable().optional(),
  head_circ_cm: z.coerce.number().min(0).max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  v => v.weight_kg != null || v.height_cm != null || v.head_circ_cm != null,
  { message: 'At least one measurement is required' }
);

export const MedicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(120).nullable().optional(),
  route: z.enum(['oral','topical','inhaled','nasal','rectal','injection','other']),
  frequency_hours: z.coerce.number().min(0.25).max(168).nullable().optional(),
  total_doses: z.coerce.number().int().min(0).max(9999).nullable().optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable().optional(),
  doctor_id: z.string().uuid().nullable().optional(),
  prescribed_by: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const MedicationLogSchema = z.object({
  medication_id: z.string().uuid(),
  medication_time: z.string().min(1),
  status: z.enum(['taken','missed','skipped']),
  actual_dosage: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const BabySchema = z.object({
  name: z.string().min(1).max(120),
  dob: z.string().min(1),
  gender: z.enum(['male','female']),
  birth_weight_kg: z.coerce.number().min(0).max(10).nullable().optional(),
  birth_height_cm: z.coerce.number().min(0).max(80).nullable().optional(),
  feeding_factor: z.coerce.number().min(50).max(250).default(150),
  blood_type: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown']).nullable().optional(),
  doctor_name: z.string().max(200).nullable().optional(),
  doctor_phone: z.string().max(40).nullable().optional(),
  doctor_clinic: z.string().max(200).nullable().optional(),
  next_appointment_at: z.string().nullable().optional(),
  next_appointment_notes: z.string().max(400).nullable().optional(),
});

export const SleepSchema = z.object({
  start_at: z.string().min(1),
  end_at: z.string().nullable().optional(),
  location: z.enum(['crib','bed','car','stroller','arms','other']),
  quality: z.enum(['sound','restless','woke_often','unknown']).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  v => !v.end_at || new Date(v.end_at).getTime() >= new Date(v.start_at).getTime(),
  { message: 'End time must be after start time', path: ['end_at'] },
);

export const ScreenTimeSchema = z.object({
  started_at:    z.string().min(1),
  duration_min:  z.coerce.number().int().min(1).max(1440),
  content_type:  z.enum(['educational','entertainment','video_call','passive','other']).nullable().optional(),
  device:        z.enum(['tv','tablet','phone','laptop','other']).nullable().optional(),
  notes:         z.string().max(2000).nullable().optional(),
});

export const ActivitySchema = z.object({
  started_at:    z.string().min(1),
  duration_min:  z.coerce.number().int().min(1).max(720).nullable().optional(),
  activity_type: z.string().min(1).max(120),
  intensity:     z.enum(['low','moderate','high']).nullable().optional(),
  location:      z.string().max(120).nullable().optional(),
  mood:          z.enum(['happy','calm','fussy','tired','curious','other']).nullable().optional(),
  notes:         z.string().max(2000).nullable().optional(),
});

export const ShoppingItemSchema = z.object({
  scope:    z.enum(['baby','pregnancy']).default('baby'),
  name:     z.string().min(1).max(200),
  category: z.string().max(80).nullable().optional(),
  quantity: z.string().max(80).nullable().optional(),
  priority: z.enum(['low','normal','high']).default('normal'),
  notes:    z.string().max(1000).nullable().optional(),
  is_done:  z.boolean().optional(),
});

export const TeethingSchema = z.object({
  observed_at: z.string().min(1),
  tooth_label: z.string().max(60).nullable().optional(),
  event_type:  z.enum(['eruption','swelling','pain','fever','soothing','lost']),
  pain_level:  z.coerce.number().int().min(0).max(10).nullable().optional(),
  fever_c:     z.coerce.number().min(30).max(45).nullable().optional(),
  soother_used:z.string().max(120).nullable().optional(),
  notes:       z.string().max(2000).nullable().optional(),
});

export const SpeakingSchema = z.object({
  observed_at:    z.string().min(1),
  word_or_phrase: z.string().max(200).nullable().optional(),
  category:       z.enum(['coo','babble','word','phrase','sentence','other']),
  language:       z.string().max(20).nullable().optional(),
  is_first_use:   z.boolean().optional(),
  context:        z.string().max(500).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
});

export const DevelopmentalMilestoneSchema = z.object({
  milestone_id: z.enum(['first_tooth','crawling','first_words','walking','first_sentence']),
  observed_at:  z.string().min(1),
  notes:        z.string().max(1000).nullable().optional(),
});

export const TemperatureSchema = z.object({
  measured_at: z.string().min(1),
  temperature_c: z.coerce.number().min(30).max(45),
  method: z.enum(['axillary','oral','rectal','ear','forehead','other']),
  notes: z.string().max(2000).nullable().optional(),
});

export const DoctorSchema = z.object({
  name:      z.string().min(1).max(200),
  specialty: z.string().max(120).nullable().optional(),
  clinic:    z.string().max(200).nullable().optional(),
  phone:     z.string().max(40).nullable().optional(),
  email:     z.string().email().max(200).nullable().optional().or(z.literal('').transform(() => null)),
  address:   z.string().max(400).nullable().optional(),
  notes:     z.string().max(2000).nullable().optional(),
  is_primary: z.boolean().optional(),
});

export const AppointmentSchema = z.object({
  doctor_id:   z.string().uuid().nullable().optional(),
  scheduled_at: z.string().min(1),
  duration_min: z.coerce.number().int().min(1).max(600).nullable().optional(),
  purpose:     z.string().max(200).nullable().optional(),
  location:    z.string().max(200).nullable().optional(),
  status:      z.enum(['scheduled','completed','cancelled','missed','rescheduled']).default('scheduled'),
  notes:       z.string().max(2000).nullable().optional(),
  conclusion:  z.string().max(4000).nullable().optional(),
});

// ----- Medical Profile schemas -----
export const AdmissionSchema = z.object({
  admitted_at: z.string().min(1),
  hospital:    z.string().max(200).nullable().optional(),
  department:  z.string().max(120).nullable().optional(),
  reason:      z.string().max(2000).nullable().optional(),
  diagnosis:   z.string().max(2000).nullable().optional(),
  notes:       z.string().max(4000).nullable().optional(),
  file_id:     z.string().uuid().nullable().optional(),
});

export const DischargeSchema = z.object({
  discharged_at: z.string().min(1),
  admission_id:  z.string().uuid().nullable().optional(),
  hospital:      z.string().max(200).nullable().optional(),
  diagnosis:     z.string().max(2000).nullable().optional(),
  treatment:     z.string().max(4000).nullable().optional(),
  follow_up:     z.string().max(2000).nullable().optional(),
  notes:         z.string().max(4000).nullable().optional(),
  file_id:       z.string().uuid().nullable().optional(),
});

export const LabPanelSchema = z.object({
  panel_kind: z.enum([
    'blood','urine','stool','culture','genetic','other',
    'imaging',                                  // legacy bucket
    'xray','mri','ct','ultrasound','ekg',
  ]),
  panel_name: z.string().min(1).max(200),
  sample_at:  z.string().nullable().optional(),
  result_at:  z.string().min(1),
  lab_name:   z.string().max(200).nullable().optional(),
  summary:    z.string().max(2000).nullable().optional(),
  abnormal:   z.boolean().optional(),
  file_id:    z.string().uuid().nullable().optional(),
  notes:      z.string().max(4000).nullable().optional(),
});

export const LabPanelItemSchema = z.object({
  test_name:   z.string().min(1).max(200),
  value:       z.string().max(200).nullable().optional(),
  unit:        z.string().max(40).nullable().optional(),
  reference:   z.string().max(120).nullable().optional(),
  is_abnormal: z.boolean().optional(),
  flag:        z.enum(['low','high','critical','positive','negative']).nullable().optional(),
  notes:       z.string().max(400).nullable().optional(),
});

export const AllergySchema = z.object({
  allergen:     z.string().min(1).max(200),
  category:     z.enum(['food','drug','environmental','contact','latex','other']).nullable().optional(),
  reaction:     z.string().max(1000).nullable().optional(),
  severity:     z.enum(['mild','moderate','severe','life_threatening']),
  diagnosed_at: z.string().nullable().optional(),
  status:       z.enum(['active','resolved','suspected']),
  notes:        z.string().max(2000).nullable().optional(),
});

export const MedicalConditionSchema = z.object({
  name:         z.string().min(1).max(200),
  icd_code:     z.string().max(40).nullable().optional(),
  diagnosed_at: z.string().nullable().optional(),
  status:       z.enum(['active','resolved','chronic','suspected']),
  treatment:    z.string().max(2000).nullable().optional(),
  notes:        z.string().max(2000).nullable().optional(),
});

// ----- Pregnancy / lifecycle schemas -----
export const PregnancyOnboardSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  edd: z.string().nullable().optional(),
  lmp: z.string().nullable().optional(),
  conception_method: z.enum(['natural','ivf','iui','icsi','other']).nullable().optional(),
}).refine(
  v => !!v.edd || !!v.lmp,
  { message: 'Enter either an EDD or an LMP date.', path: ['edd'] },
);

export const PregnancyProfileSchema = z.object({
  mother_dob:               z.string().nullable().optional(),
  mother_blood_type:        z.string().max(10).nullable().optional(),
  gravida:                  z.coerce.number().int().min(0).max(30).nullable().optional(),
  para:                     z.coerce.number().int().min(0).max(30).nullable().optional(),
  pre_pregnancy_weight_kg:  z.coerce.number().min(20).max(300).nullable().optional(),
  pre_pregnancy_height_cm:  z.coerce.number().min(100).max(250).nullable().optional(),
  risk_factors:             z.string().max(2000).nullable().optional(),
  notes:                    z.string().max(4000).nullable().optional(),
});

export const PrenatalVisitSchema = z.object({
  visited_at:           z.string().min(1),
  gestational_week:     z.coerce.number().int().min(0).max(45).nullable().optional(),
  gestational_day:      z.coerce.number().int().min(0).max(6).nullable().optional(),
  maternal_weight_kg:   z.coerce.number().min(20).max(300).nullable().optional(),
  bp_systolic:          z.coerce.number().int().min(50).max(260).nullable().optional(),
  bp_diastolic:         z.coerce.number().int().min(30).max(180).nullable().optional(),
  fetal_heart_rate_bpm: z.coerce.number().int().min(50).max(250).nullable().optional(),
  fundal_height_cm:     z.coerce.number().min(0).max(60).nullable().optional(),
  doctor_id:            z.string().uuid().nullable().optional(),
  file_id:              z.string().uuid().nullable().optional(),
  notes:                z.string().max(4000).nullable().optional(),
});

export const UltrasoundSchema = z.object({
  scanned_at:        z.string().min(1),
  gestational_week:  z.coerce.number().int().min(0).max(45).nullable().optional(),
  gestational_day:   z.coerce.number().int().min(0).max(6).nullable().optional(),
  bpd_mm:            z.coerce.number().min(0).max(200).nullable().optional(),
  hc_mm:             z.coerce.number().min(0).max(500).nullable().optional(),
  ac_mm:             z.coerce.number().min(0).max(500).nullable().optional(),
  fl_mm:             z.coerce.number().min(0).max(150).nullable().optional(),
  efw_g:             z.coerce.number().min(0).max(8000).nullable().optional(),
  fhr_bpm:           z.coerce.number().int().min(50).max(250).nullable().optional(),
  placenta_position: z.string().max(120).nullable().optional(),
  amniotic_fluid:    z.string().max(120).nullable().optional(),
  sex_predicted:     z.enum(['male','female','undetermined']).nullable().optional(),
  anomalies:         z.string().max(4000).nullable().optional(),
  summary:           z.string().max(2000).nullable().optional(),
  file_id:           z.string().uuid().nullable().optional(),
});

export const FetalMovementSchema = z.object({
  counted_at:    z.string().min(1),
  duration_min:  z.coerce.number().int().min(1).max(240),
  movements:     z.coerce.number().int().min(0).max(999),
  notes:         z.string().max(2000).nullable().optional(),
});

export const MarkAsBornSchema = z.object({
  dob:              z.string().min(1),
  birth_weight_kg:  z.coerce.number().min(0).max(10).nullable().optional(),
  birth_height_cm:  z.coerce.number().min(0).max(80).nullable().optional(),
  head_circ_cm:     z.coerce.number().min(0).max(80).nullable().optional(),
  gender:           z.enum(['male','female']).nullable().optional(),
});

export const CarePlanSchema = z.object({
  medical_plan: z.string().max(4000).nullable().optional(),
  feeding_plan: z.string().max(4000).nullable().optional(),
  labs_needed:  z.string().max(2000).nullable().optional(),
  blood_type:   z.string().max(10).nullable().optional(),
});

export const VaccinationSchema = z.object({
  vaccine_name: z.string().min(1).max(200),
  scheduled_at: z.string().nullable().optional(),
  administered_at: z.string().nullable().optional(),
  dose_number: z.coerce.number().int().min(1).max(10).nullable().optional(),
  total_doses: z.coerce.number().int().min(1).max(10).nullable().optional(),
  status: z.enum(['scheduled','administered','skipped','missed']),
  provider: z.string().max(200).nullable().optional(),
  batch_number: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
