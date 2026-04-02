import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  CalendarDays,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Deals", href: "/deals", icon: Target },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Activities", href: "/activities", icon: CalendarDays },
];

export function Sidebar() {
  const [location] = useLocation();

  const NavLinks = () => (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href}>
            <span
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden border-r bg-sidebar md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
          <Link href="/">
            <span className="flex items-center gap-2 font-bold text-xl text-sidebar-primary cursor-pointer tracking-tight">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold">Z</span>
              </div>
              Zing CRM
            </span>
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          <NavLinks />
        </div>
      </div>
    </>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar text-sidebar-foreground border-sidebar-border p-0">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
          <Link href="/" onClick={() => setOpen(false)}>
            <span className="flex items-center gap-2 font-bold text-xl text-sidebar-primary cursor-pointer tracking-tight">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold">Z</span>
              </div>
              Zing CRM
            </span>
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.name} href={item.href} onClick={() => setOpen(false)}>
                  <span
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-64 w-full max-w-[100vw]">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background/95 backdrop-blur px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 md:hidden">
          <MobileNav />
          <div className="flex flex-1 items-center justify-between font-bold text-lg tracking-tight">
            <span>Zing CRM</span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
