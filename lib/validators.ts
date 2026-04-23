import { z } from 'zod';

export const FeedingSchema = z.object({
  feeding_time: z.string().min(1),                  // ISO
  milk_type: z.enum(['breast','formula','mixed','solid','other']),
  quantity_ml: z.coerce.number().min(0).max(2000).nullable().optional(),
  kcal: z.coerce.number().min(0).max(5000).nullable().optional(),
  duration_min: z.coerce.number().min(0).max(600).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

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
  gender: z.enum(['male','female','other','unspecified']),
  birth_weight_kg: z.coerce.number().min(0).max(10).nullable().optional(),
  birth_height_cm: z.coerce.number().min(0).max(80).nullable().optional(),
  feeding_factor: z.coerce.number().min(50).max(250).default(150),
});
