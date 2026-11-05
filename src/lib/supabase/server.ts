import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** 요청의 세션 쿠키를 사용하는 서버용 클라이언트 (RLS 가 로그인 사용자 기준으로 적용됨) */
export async function createClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component 에서 호출된 경우 무시 (proxy 가 세션을 갱신함)
        }
      },
    },
  });
}
