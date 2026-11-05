import type { Metadata } from "next";
import { AuthForm } from "@/components/layout/auth-form";

export const metadata: Metadata = { title: "비밀번호 재설정", robots: { index: false } };

export default function Page() {
  return <AuthForm mode="reset" />;
}
