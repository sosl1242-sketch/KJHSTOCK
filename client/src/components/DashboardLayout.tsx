import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, Bitcoin, Globe2, LogOut, PanelLeft } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import PasswordLogin from "@/pages/PasswordLogin";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: BarChart3, label: "국내주식 섹터분석", path: "/" },
  { icon: Globe2, label: "해외주식 섹터분석", path: "/global-stocks" },
  { icon: Bitcoin, label: "크립토 섹터분석", path: "/crypto-sectors" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [isPasswordVerified, setIsPasswordVerified] = useState(() => {
    return localStorage.getItem("auth_token") === "verified";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!isPasswordVerified) {
    return <PasswordLogin />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              분석 대시보드에 로그인
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              국내주식, 해외주식, 크립토 섹터 분석 도구는 인증된 사용자에게만 제공됩니다. 오너는 국내 종목 데이터 편집과 현재가 갱신 기능을 사용할 수 있습니다.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar className="border-r">
        <SidebarHeader className="flex items-center justify-between px-4 py-3">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{user?.name || "User"}</div>
                  <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => {
                  localStorage.removeItem("auth_token");
                  window.location.href = "/";
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
