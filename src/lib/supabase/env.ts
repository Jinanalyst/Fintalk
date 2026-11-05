// NEXT_PUBLIC_* 값은 빌드 시 인라인되므로 반드시 이렇게 리터럴로 참조해야 합니다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 환경변수가 없으면 Phase 1 처럼 샘플 데이터 모드로 동작합니다. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
