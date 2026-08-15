import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpenText, Bot, ChevronRight, CircleUserRound, ClipboardPenLine,
  LayoutDashboard, LogIn, PanelLeft, Settings2, Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "./ui/sidebar";

const navigation = [
  { icon: LayoutDashboard, label: "概要", sublabel: "Overview", path: "/" },
  { icon: BookOpenText, label: "ネタ管理", sublabel: "Ideas", path: "/ideas" },
  { icon: Sparkles, label: "投稿案", sublabel: "Studio", path: "/drafts" },
  { icon: ClipboardPenLine, label: "実績", sublabel: "Performance", path: "/results" },
  { icon: BarChart3, label: "分析", sublabel: "Insights", path: "/analysis" },
  { icon: Settings2, label: "設定", sublabel: "Settings", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SidebarProvider defaultOpen><DashboardLayoutContent>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const active = navigation.find(item => item.path === location) ?? navigation[0];

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="h-[92px] justify-center px-3">
          <div className="flex w-full items-center gap-3">
            <button onClick={toggleSidebar} aria-label="ナビゲーションを切り替える" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-sidebar-foreground transition hover:bg-white/10">
              <PanelLeft className="h-4 w-4" />
            </button>
            {!isCollapsed && <button onClick={() => setLocation("/")} className="flex min-w-0 items-center gap-2.5 text-left">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[oklch(0.76_0.12_75)] text-[oklch(0.22_0.03_257)] shadow-lg shadow-black/20"><Bot className="h-5 w-5" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-bold tracking-tight">Growth Copilot</p><p className="mono mt-0.5 text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/55">SNS intelligence</p></div>
            </button>}
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-2">
          {!isCollapsed && <p className="mono mb-3 px-3 text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/45">Workspace</p>}
          <SidebarMenu className="gap-1">
            {navigation.map(item => {
              const isActive = location === item.path;
              return <SidebarMenuItem key={item.path}>
                <SidebarMenuButton tooltip={item.label} isActive={isActive} onClick={() => setLocation(item.path)} className={cn("h-12 rounded-xl px-3 text-sidebar-foreground/72 transition-all hover:bg-white/8 hover:text-sidebar-foreground", isActive && "nav-active bg-white/10 text-sidebar-foreground hover:bg-white/10")}>
                  <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-[oklch(0.76_0.12_75)]")} />
                  <span className="flex min-w-0 flex-1 items-center justify-between"><span className="font-medium">{item.label}</span>{!isCollapsed && <span className="mono text-[9px] tracking-wider text-sidebar-foreground/38">{item.sublabel}</span>}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mt-auto p-3">
          {isAuthenticated ? <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5"><div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-xs font-bold">{user?.name?.slice(0, 1) ?? "U"}</div>{!isCollapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold">{user?.name ?? "メンバー"}</p><p className="truncate text-[10px] text-sidebar-foreground/50">あなたのワークスペース</p></div>}</div> : <button onClick={() => startLogin()} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left text-xs font-semibold transition hover:bg-white/10"><LogIn className="h-4 w-4 shrink-0 text-[oklch(0.76_0.12_75)]" />{!isCollapsed && <span>ログインして始める</span>}</button>}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-transparent">
        {isMobile && <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur"><SidebarTrigger className="h-9 w-9 rounded-xl bg-card shadow-sm" /><div><p className="text-sm font-semibold">{active.label}</p><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{active.sublabel}</p></div><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></header>}
        <main className="page-shell min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
