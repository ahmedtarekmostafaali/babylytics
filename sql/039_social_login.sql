-- 039: Social sign-in (Google / Apple / Facebook). UI-only — Supabase
-- handles the OAuth handshake at the platform level. The actual
-- provider configuration happens in the Supabase dashboard:
--
--   Authentication → Providers → Google     (client id + secret)
--   Authentication → Providers → Apple      (services id + key id + team id + p8 key)
--   Authentication → Providers → Facebook   (app id + app secret)
--
-- Redirect URL to register with each provider:
--   https://<your-supabase-ref>.supabase.co/auth/v1/callback
--
-- Plus add this Site URL + Redirect URL inside Supabase
-- Authentication → URL Configuration:
--   Site URL: https://babylytics.org
--   Redirect URLs: https://babylytics.org/auth/callback,
--                  http://localhost:3000/auth/callback (dev)

select public.publish_app_update(
  p_title    => 'Sign in with Google, Apple, or Facebook',
  p_body     => 'You can now create an account or log in with one tap using your Google, Apple, or Facebook account — no separate password to remember. Existing users with an email/password account can still sign in the same way; OAuth is added alongside, not in place of. We never receive your provider password and never post anything to your social account. (Setup is per-deploy; provider buttons appear only after Babylytics admins enable each provider in the Supabase dashboard.)',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'تسجيل الدخول بحساب جوجل أو آبل أو فيسبوك',
  p_body_ar  => 'يمكنك الآن إنشاء حساب أو تسجيل الدخول بضغطة واحدة باستخدام حساب جوجل أو آبل أو فيسبوك — بدون كلمة مرور منفصلة تحفظينها. المستخدمون الحاليون بحساب بريد + كلمة مرور لا يزالون يدخلون كالمعتاد؛ الدخول الاجتماعي يضاف وليس بديلًا. لا نستلم كلمة مرورك من المزوّد ولا ننشر أي شيء على حسابك. (الإعداد لكل نشر؛ الأزرار تظهر فقط بعد تفعيل المزوّد في لوحة سوبرابيس.)'
);
