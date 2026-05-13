import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { useState } from "react";

interface PasswordLoginProps {
  /** 인증 성공 시 호출되는 콜백. 제공되지 않으면 페이지를 새로고침합니다. */
  onVerified?: () => void;
}

export default function PasswordLogin({ onVerified }: PasswordLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (password === "5690") {
      localStorage.setItem("auth_token", "verified");
      if (onVerified) {
        onVerified();
      } else {
        window.location.href = "/";
      }
    } else {
      setError("비밀번호가 틀렸습니다");
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md rounded-2xl border-0 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-blue-100 p-3">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">K-Stock Lab</CardTitle>
          <CardDescription>비밀번호를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="rounded-lg"
            autoFocus
          />
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button
            onClick={handleLogin}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700"
          >
            입장
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
