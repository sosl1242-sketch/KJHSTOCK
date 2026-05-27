import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";

interface PasswordLoginProps {
  /** 인증 성공 시 호출되는 콜백. 제공되지 않으면 페이지를 새로고침합니다. */
  onVerified?: () => void;
}

export default function PasswordLogin({ onVerified }: PasswordLoginProps) {
  const signUpMutation = trpc.auth.signUp.useMutation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      setError("Supabase 환경변수가 아직 설정되지 않았습니다.");
      return;
    }

    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력하세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "signup") {
        await signUpMutation.mutateAsync({
          email: normalizedEmail,
          password,
        });
        setMessage("가입 완료. 바로 로그인합니다.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      if (onVerified) {
        onVerified();
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "로그인 처리에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(current => (current === "signin" ? "signup" : "signin"));
    setError("");
    setMessage("");
    setPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md rounded-2xl border-0 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-blue-100 p-3">
              {mode === "signin" ? <Lock className="h-6 w-6 text-blue-600" /> : <Mail className="h-6 w-6 text-blue-600" />}
            </div>
          </div>
          <CardTitle className="text-2xl">K-Stock Lab</CardTitle>
          <CardDescription>{mode === "signin" ? "가입한 이메일로 로그인하세요" : "이메일 인증 없이 바로 가입합니다"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="rounded-lg"
            autoFocus
          />
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="rounded-lg"
          />
          {error && <div className="text-sm text-red-500">{error}</div>}
          {message && <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? "처리 중..." : mode === "signin" ? "로그인" : "바로 가입"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={toggleMode}
            className="w-full rounded-lg"
          >
            {mode === "signin" ? "계정이 없으면 회원가입" : "이미 계정이 있으면 로그인"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
