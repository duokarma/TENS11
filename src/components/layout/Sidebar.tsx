import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Users, Package, Calendar, 
  FileText, PieChart, Scissors,
  LogOut, User as UserIcon, List, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import RoleGuard from './RoleGuard';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  allowedRoles: UserRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Calendar', href: '/calendar', icon: Calendar, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Customer Management', href: '/customers', icon: Users, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Services', href: '/services', icon: List, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Packages', href: '/packages', icon: Tag, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Inventory', href: '/inventory', icon: Package, allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
  { name: 'Staff', href: '/staff', icon: Users, allowedRoles: ['Owner', 'Manager'] },
  { name: 'Expenses', href: '/expenses', icon: FileText, allowedRoles: ['Owner', 'Manager'] },
  { name: 'Accounts', href: '/accounts', icon: PieChart, allowedRoles: ['Owner', 'Manager'] },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full w-full flex-col glass-sidebar rounded-[24px] relative overflow-hidden">
      
      {/* Brand Header */}
      <div className="flex h-24 shrink-0 items-center px-8 border-b border-black/5 relative">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center mr-3 shadow-sm border border-primary/30">
          <Scissors className="text-primary-foreground w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          WOW <span className="text-white/60 font-medium">SALON</span>
        </h1>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar px-4 py-6 bg-transparent">
        <nav className="flex-1 space-y-2">
          <div className="px-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60/60">Menu</p>
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <RoleGuard key={item.name} allowedRoles={item.allowedRoles}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'relative group flex items-center rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-300',
                      isActive 
                        ? 'text-primary-foreground font-bold bg-primary/20 border border-primary/30 shadow-sm' 
                        : 'text-white/60 hover:bg-black/5 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex items-center z-10 w-full">
                        <Icon
                          className={cn("mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300 group-hover:scale-110", 
                            isActive ? "text-primary-foreground" : "text-white/60 group-hover:text-white"
                          )}
                          aria-hidden="true"
                        />
                        <span className="relative z-10">{item.name}</span>
                      </div>
                    </>
                  )}
                </NavLink>
              </RoleGuard>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-black/5 bg-black/40/40 space-y-3 relative">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 bg-black/40/60 rounded-xl border border-black/5 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20">
              <UserIcon className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile.email.split('@')[0]}</p>
              <p className="text-xs font-medium text-white/60 truncate uppercase tracking-wider">{profile.role}</p>
            </div>
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="w-full group flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-danger hover:bg-danger/10 transition-all duration-300 border border-transparent hover:border-danger/20"
        >
          <LogOut className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
