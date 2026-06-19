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
      <div className="flex h-24 shrink-0 items-center px-6 border-b border-white/[0.05] relative">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mr-3 shrink-0"
          style={{
            background: 'rgba(214,193,163,0.12)',
            border: '1px solid rgba(214,193,163,0.25)',
          }}
        >
          <Scissors className="w-4 h-4" style={{ color: '#D6C1A3' }} strokeWidth={1.5} />
        </div>
        <div>
          <h1
            className="text-base font-semibold tracking-wide leading-none"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#F7F3EE' }}
          >
            TENS11
          </h1>
          <p className="text-[10px] tracking-[0.18em] uppercase mt-0.5" style={{ color: 'rgba(214,193,163,0.6)' }}>
            SALON
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar px-3 py-5 bg-transparent">
        <nav className="flex-1 space-y-1">
          <div className="px-3 pb-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(207,199,188,0.35)' }}>
              Navigation
            </p>
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <RoleGuard key={item.name} allowedRoles={item.allowedRoles}>
                <NavLink
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                      isActive
                        ? 'text-[#F7F3EE]'
                        : 'text-[#CFC7BC] hover:text-[#F7F3EE]'
                    )
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'rgba(214,193,163,0.1)',
                    border: '1px solid rgba(214,193,163,0.18)',
                  } : {
                    background: 'transparent',
                    border: '1px solid transparent',
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active left indicator */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                          style={{ background: '#D6C1A3' }}
                        />
                      )}
                      <Icon
                        className={cn(
                          'mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200',
                          isActive ? 'text-[#D6C1A3]' : 'text-[#CFC7BC] group-hover:text-[#D6C1A3]'
                        )}
                        strokeWidth={isActive ? 2 : 1.5}
                        aria-hidden="true"
                      />
                      <span className="relative z-10 text-[13px]">{item.name}</span>
                    </>
                  )}
                </NavLink>
              </RoleGuard>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div
        className="p-3 space-y-2 relative"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {profile && (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(214,193,163,0.12)', border: '1px solid rgba(214,193,163,0.2)' }}
            >
              <UserIcon className="w-3.5 h-3.5" style={{ color: '#D6C1A3' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: '#F7F3EE' }}>
                {profile.email.split('@')[0]}
              </p>
              <p className="text-[10px] uppercase tracking-wider truncate" style={{ color: 'rgba(207,199,188,0.5)' }}>
                {profile.role}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full group flex items-center justify-center rounded-xl px-4 py-2.5 text-[12px] font-medium transition-all duration-200"
          style={{ color: '#D1A2A2', border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(209,162,162,0.08)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(209,162,162,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }}
        >
          <LogOut className="mr-2 h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
