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
