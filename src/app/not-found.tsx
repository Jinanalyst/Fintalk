import { MainShell } from "@/components/layout/shell";
import { NotFoundCard } from "@/components/common/not-found-card";

// 라우트 그룹 밖(알 수 없는 주소)에서만 사용됩니다. 그룹 안에서는 이미 레이아웃이 감싸므로 셸을 중복하지 않습니다.
export default function NotFound() {
  return (
    <MainShell>
      <NotFoundCard />
    </MainShell>
  );
}
