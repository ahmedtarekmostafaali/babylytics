// Arabic copy. Keys must match the shape of messages.en.ts exactly — the
// Messages type enforces it at compile time.
import type { Messages } from './messages.en';

export const ar: Messages = {
  app: {
    name: 'بيبيليتيكس',
    tagline: 'رعاية موثّقة.',
  },
  nav: {
    my_babies: 'أطفالي',
    overview: 'نظرة عامة',
    add_baby: 'إضافة طفل',
    sign_out: 'تسجيل الخروج',

    cat_overview: 'نظرة عامة',
    cat_vital_signs: 'العلامات الحيوية',
    cat_care: 'الرعاية',
    cat_development: 'التطور',
    cat_records: 'السجلات',
    cat_family: 'العائلة',

    feedings: 'الرضعات',
    stool: 'البراز',
    sleep: 'النوم',
    temperature: 'الحرارة',
    measurements: 'القياسات',

    medications: 'الأدوية',
    vaccinations: 'التطعيمات',
    appointments: 'المواعيد',
    labs_scans: 'التحاليل والأشعة',

    activities: 'الأنشطة',
    teething: 'التسنين',
    speaking: 'الكلام',
    screen_time: 'وقت الشاشة',

    files: 'المسح الذكي',
    medical_profile: 'الملف الطبي',
    reports: 'التقارير',
    shopping: 'قائمة التسوق',

    caregivers: 'مقدمو الرعاية',
    doctors: 'الأطباء',
    preferences: 'التفضيلات',
  },

  common: {
    save: 'حفظ',
    save_changes: 'حفظ التغييرات',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    confirm: 'تأكيد',
    close: 'إغلاق',
    back: 'رجوع',
    next: 'التالي',
    yes: 'نعم',
    no: 'لا',
    today: 'اليوم',
    yesterday: 'الأمس',
    loading: 'جارٍ التحميل…',
    saving: 'جارٍ الحفظ…',
    no_data: 'لا توجد بيانات',
    optional: 'اختياري',
    required: 'مطلوب',
    notes: 'ملاحظات',
    when: 'متى؟',
    now: 'الآن',
  },

  prefs: {
    title: 'التفضيلات',
    subtitle: 'اللغة والمنطقة والوحدات وطريقة استلام الإشعارات.',
    language: 'اللغة',
    language_en: 'English',
    language_ar: 'العربية',
    country: 'الدولة',
    timezone: 'المنطقة الزمنية',
    time_format: 'تنسيق الوقت',
    time_12h: '12 ساعة (3:45 م)',
    time_24h: '24 ساعة (15:45)',
    units: 'الوحدات',
    units_metric: 'متري (كجم، سم، °م، مل)',
    units_imperial: 'إمبراطوري (رطل، بوصة، °ف، أونصة سائلة)',
    notifications: 'الإشعارات',
    whatsapp_number: 'رقم واتساب (E.164)',
    whatsapp_help: 'أدخل رمز الدولة، مثل +201234567890.',
    whatsapp_optin: 'إرسال تذكيرات الأدوية إلى واتساب',
    saved: 'تم حفظ التفضيلات.',
  },

  auth: {
    sign_in: 'تسجيل الدخول',
    sign_up: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    forgot: 'نسيت كلمة المرور؟',
  },
};
