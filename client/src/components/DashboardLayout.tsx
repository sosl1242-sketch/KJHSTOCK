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
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart3, Bitcoin, Globe2, Loader2, Lock } from "lucide-react";
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

  const [showLoginModal, setShowLoginModal] = useState(false);
  const { user, logout, loading, refresh } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    const openLogin = () => setShowLoginModal(true);
    window.addEventListener("supabase-auth-required", openLogin);
    return () => window.removeEventListener("supabase-auth-required", openLogin);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-white">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        로그인 상태 확인 중
      </div>
    );
  }

  if (!user || showLoginModal) {
    return (
      <PasswordLogin
        onVerified={() => {
          setShowLoginModal(false);
          void refresh();
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
          {user && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                void logout();
              }}
            >
              <Lock className="h-4 w-4" />
              <span>로그아웃</span>
            </Button>
          )}
          {!user && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              disabled={loading}
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
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
