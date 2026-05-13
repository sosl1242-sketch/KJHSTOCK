import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { BarChart3, Bitcoin, Globe2, Lock } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import PasswordLogin from "@/pages/PasswordLogin";
import { Button } from "./ui/button";

const menuItems = [
  { icon: BarChart3, label: "국내주식 섹터분석", path: "/" },
  { icon: Globe2, label: "해외주식 섹터분석", path: "/global-stocks" },
  { icon: Bitcoin, label: "크립토 섹터분석", path: "/crypto-sectors" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  const [isPasswordVerified, setIsPasswordVerified] = useState(() => {
    return localStorage.getItem("auth_token") === "verified";
  });

  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // 로그인 모달이 열려있으면 표시
  if (showLoginModal) {
    return (
      <PasswordLogin
        onVerified={() => {
          setIsPasswordVerified(true);
          setShowLoginModal(false);
        }}
      />
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar className="border-r">
        <SidebarHeader className="px-4 py-3">
          <h1 className="text-lg font-bold">K-Stock Lab</h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild>
                  <a href={item.path} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          {isPasswordVerified && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                localStorage.removeItem("auth_token");
                setIsPasswordVerified(false);
              }}
            >
              <Lock className="h-4 w-4" />
              <span>로그아웃</span>
            </Button>
          )}
          {!isPasswordVerified && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowLoginModal(true)}
            >
              <Lock className="h-4 w-4" />
              <span>로그인</span>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex-1">
          {/* 비로그인 사용자에게 편집 기능 불가 정보 전달 */}
          {!isPasswordVerified && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              조회 기능은 누구나 사용 가능합니다. 편집 기능을 사용하려면 로그인하세요.
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
