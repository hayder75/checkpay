import { Link, useLocation } from 'react-router-dom';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  History,
  Settings,
  Crown,
  BarChart3,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Building2,
  Users,
  FolderKanban,
  Activity,
  Key,
  Plus,
  Clock,
  BookOpen,
  Shield,
  Globe,
  ShoppingCart,
  Smartphone,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { authAPI } from '@/lib';
import { NotificationBell } from '@/components/NotificationBell';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/dashboard/transactions', icon: History },
  { name: 'Pending Orders', href: '/dashboard/pending-orders', icon: Clock },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

const businessOwnerNavigation = [
  { name: 'Businesses', href: '/dashboard/businesses', icon: Building2 },
  { name: 'Employees', href: '/dashboard/employees', icon: Users },
  { name: 'Access Codes', href: '/dashboard/access-codes', icon: Key },
];

const developerNavigation = [
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Mobile Integration', href: '/dashboard/mobile', icon: Smartphone },
  { name: 'Bank Management', href: '/dashboard/patterns', icon: Building2 },
  { name: 'Usage', href: '/dashboard/usage', icon: Activity },
  { name: 'API Docs', href: '/api-docs', icon: BookOpen },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const employeeNavigation = [
  { name: 'Record Transaction', href: '/dashboard/employees/record', icon: Plus },
];

const commonNavigation = [
  { name: 'Bank Management', href: '/dashboard/patterns', icon: Building2 },
  { name: 'Usage', href: '/dashboard/usage', icon: Activity },
  { name: 'API Docs', href: '/api-docs', icon: BookOpen },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin/dashboard', icon: Shield },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Pattern Review', href: '/admin/patterns', icon: FileText },
  { name: 'Transactions', href: '/admin/transactions', icon: History },
  { name: 'Countries', href: '/admin/countries', icon: Globe },
  { name: 'System Health', href: '/admin/system-health', icon: Activity },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: BookOpen },
  { name: 'Package Purchases', href: '/admin/package-purchases', icon: ShoppingCart },
];

function NavContent({ navigation, onNavigate }: { navigation: any[]; onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href || 
          (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const user = auth.getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.getUser());
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await authAPI.getMe();
        setCurrentUser(res.data.data);
      } catch (error) { /* Ignore errors */ }
    };
    if (user) loadUser();
  }, [user?.id]);

  const getNavigation = () => {
    const role = currentUser?.role;
    let nav = [...baseNavigation];
    if (role === 'DEVELOPER') { nav = [...nav, ...developerNavigation]; return nav; }
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') { nav = [...nav, ...adminNavigation]; return nav; }
    if (role === 'BUSINESS_OWNER') { nav = [...nav, ...businessOwnerNavigation, ...commonNavigation]; return nav; }
    if (role === 'EMPLOYEE') { nav = [...nav, ...employeeNavigation, { name: 'Settings', href: '/dashboard/settings', icon: Settings }]; return nav; }
    return nav;
  };

  const navigation = getNavigation();
  const handleLogout = () => { auth.logout(); };

  const SidebarContent = ({ closeSheet }: { closeSheet?: () => void }) => (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Link to="/dashboard" className="text-xl font-bold text-primary">CheckPay</Link>
        {closeSheet && <Button variant="ghost" size="icon" className="lg:hidden" onClick={closeSheet}><X className="h-5 w-5" /></Button>}
      </div>
      <NavContent navigation={navigation} onNavigate={closeSheet} />
      <div className="mt-auto border-t border-border p-4">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-3" />Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full w-64 flex-col bg-card border-r border-border">
        <SidebarContent />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
          </SheetHeader>
          <SidebarContent closeSheet={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-card/95 backdrop-blur border-b border-border flex items-center">
          <div className="w-full px-4 lg:px-8 flex items-center justify-between">
            <div className="lg:hidden w-10" />
            <div className="flex-1 lg:flex-none">
              <h1 className="text-xl font-semibold hidden lg:block">
                {navigation.find(n => location.pathname.startsWith(n.href))?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {currentUser?.plan === 'PREMIUM' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium">
                  <Crown className="h-3 w-3" /><span>Premium</span>
                </div>
              )}
              <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1.5 bg-muted rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">{(currentUser?.username || currentUser?.email || 'U')[0].toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium">{currentUser?.username || currentUser?.email || currentUser?.phone}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}