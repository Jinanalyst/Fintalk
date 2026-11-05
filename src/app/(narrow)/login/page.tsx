import type { Metadata } from "next";
import { AuthForm } from "@/components/layout/auth-form";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

export default function Page() {
  return <AuthForm mode="login" />;
}
