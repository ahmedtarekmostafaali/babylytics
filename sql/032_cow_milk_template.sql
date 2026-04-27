-- 032: Allergy templates — quick-pick chips on the allergy form, with a
-- deeper guidance panel for cow's milk protein allergy (CMPA), the most
-- common infant food allergy. Pure UI/copy change — no schema modifications.

select public.publish_app_update(
  'Allergy quick-pick + cow''s milk allergy guide',
  'The allergy form now has quick-pick chips for the most common allergens (cow''s milk, peanut, egg, soy, wheat, sesame, fish, shellfish, tree nuts, penicillin, latex) so you don''t have to type the same thing every time. When you log a cow''s-milk allergy you also get a parent-friendly guidance card covering symptoms, hidden sources to avoid, formula and food alternatives, red-flag signs that need urgent care, and the typical "outgrows it by 3–5 years" outlook — in English and Arabic.',
  'new_feature'
);
