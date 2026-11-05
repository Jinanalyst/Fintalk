# Supabase 설정 가이드 (Phase 2)

코드는 이미 준비되어 있습니다. 아래 순서대로 **본인 Supabase 프로젝트**에서 설정하면 동작합니다.

## 1. 환경변수

프로젝트 폴더에 `.env.local` 파일을 만들고 (`.env.example` 참고):

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- 값 위치: Supabase 대시보드 → **Project Settings → API**
- Vercel: **Settings → Environment Variables** 에 같은 이름으로 추가 후 **재배포**
  (`NEXT_PUBLIC_SITE_URL` 은 배포 도메인, 예: `https://fintalk.vercel.app`)
- **secret key(service_role)** 는 넣지 않습니다. 이번 단계에서는 필요 없습니다.

환경변수가 없으면 사이트는 Phase 1 처럼 **샘플 데이터 모드**로 동작합니다.

## 2. 데이터베이스 생성

1. Supabase → **SQL Editor → New query**
2. `supabase/schema.sql` 전체를 붙여넣고 **Run**
   (테이블, RLS 정책, 트리거, 스토리지 버킷 `post-images`, 기본 카테고리가 만들어집니다. 여러 번 실행해도 안전합니다.)

## 3. 인증 주소 설정

Supabase → **Authentication → URL Configuration**

- **Site URL**: 배포 주소 (개발 중에는 `http://localhost:3000`)
- **Redirect URLs** 에 추가:
  - `http://localhost:3000/auth/callback`
  - `https://<배포도메인>/auth/callback`

**Authentication → Providers → Email**: 켜 둡니다. (이메일 인증을 켜 두면 가입 후 메일 링크를 눌러야 로그인됩니다. 테스트 중에는 *Confirm email* 을 잠시 꺼도 됩니다.)

## 4. Google 로그인 (선택)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials → Create OAuth client ID** (Web application)
2. **Authorized redirect URI** 에 Supabase 가 알려주는 주소 입력
   (Supabase → Authentication → Providers → Google 화면 상단의 *Callback URL*, 형태: `https://xxxx.supabase.co/auth/v1/callback`)
3. 발급된 **Client ID / Client Secret** 을 Supabase 의 Google Provider 에 입력하고 활성화

## 5. 관리자 지정

사이트에서 먼저 **회원가입**한 뒤, SQL Editor 에서 본인 이메일로 1회 실행:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```

이후 로그인하면 헤더에 **관리자** 메뉴가 보이고 `/admin` 에 접근할 수 있습니다.
(일반 사용자는 `/admin` 이 404 이며, 관리 작업은 DB 함수가 관리자 여부를 다시 검사합니다.)

## 6. 동작 확인 체크리스트

- [ ] 회원가입 → (인증 메일) → 로그인 / 로그아웃
- [ ] 비밀번호 재설정 메일 → 새 비밀번호 설정
- [ ] 글쓰기(이미지 첨부 포함) → 목록·상세 표시
- [ ] 댓글 / 답글 / 내 댓글 삭제
- [ ] 추천·비추천 (같은 글에 반복 추천 불가, 새로고침 후에도 유지)
- [ ] 게시글 저장 → 마이페이지 “저장한 글”
- [ ] 신고 → 관리자 화면 “신고” 탭에서 숨김/기각
- [ ] 글 수정 / 삭제는 **작성자 본인**만 가능
- [ ] 마이페이지 프로필·알림 저장, 회원 탈퇴
- [ ] 마켓 ★ 관심 종목 저장
