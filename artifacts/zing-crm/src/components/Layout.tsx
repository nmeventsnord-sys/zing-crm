import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Accueil" },
  { href: "/contacts", label: "Contacts" },
  { href: "/quotes", label: "Devis" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
              <span className="text-yellow-400 font-bold text-sm">Z</span>
            </div>
            <span className="font-bold text-blue-700 text-lg leading-tight">
              Zing CRM
              <span className="block text-xs font-normal text-gray-500 leading-none">Time to Smile</span>
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-blue-700 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-blue-700"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        Zing CRM — Time to Smile &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
