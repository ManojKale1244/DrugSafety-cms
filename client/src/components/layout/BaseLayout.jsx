import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  ClipboardList,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  LogOut,
  Shield,
  History,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SessionExpiredModal from '../auth/SessionExpiredModal';

export default function BaseLayout() {
  const location = useLocation();
  const { user, role, roleDetails, logout } = useAuth();

  // Dynamic navigation configuration based on role
  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Case Intake', icon: ClipboardList },
          { to: '/cases', label: 'Cases & Safety', icon: FolderOpen },
          { to: '/admin/users', label: 'User Management', icon: Users, badge: 'Admin' },
          { to: '/admin/audits', label: 'Audit Trail', icon: History, badge: 'Audit' },
        ];
      case 'case_manager':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Case Intake', icon: ClipboardList },
          { to: '/cases', label: 'Case Management', icon: FolderOpen },
          { to: '/workload', label: 'Team Workload', icon: UserCheck },
          { to: '/action-items', label: 'Action Items', icon: CheckSquare },
          { to: '/reports', label: 'Safety Reports', icon: FileSpreadsheet },
        ];
      case 'reviewer':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Case Intake', icon: ClipboardList },
          { to: '/cases', label: 'My Assigned Cases', icon: FolderOpen },
          { to: '/action-items', label: 'Action Items', icon: CheckSquare },
          { to: '/medical-review', label: 'Medical Assessment', icon: ClipboardList },
        ];
      case 'data_entry':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Adverse Event Intake', icon: ClipboardList },
          { to: '/cases', label: 'Case Registry', icon: FolderOpen },
          { to: '/contact-logs', label: 'Contact Log Registry', icon: FileText },
        ];
      case 'qa_specialist':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Case Intake', icon: ClipboardList },
          { to: '/cases', label: 'Case Quality Review', icon: FolderOpen },
          { to: '/admin/audits', label: 'Compliance Audits', icon: History },
          { to: '/action-items', label: 'Action Items', icon: CheckSquare },
        ];
      case 'regulatory_affairs':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Case Intake', icon: ClipboardList },
          { to: '/cases', label: 'Regulatory Cases', icon: FolderOpen },
          { to: '/reports', label: 'Submission Reports', icon: FileSpreadsheet },
        ];
      case 'viewer':
      default:
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/intakes', label: 'Intake Records', icon: ClipboardList },
          { to: '/cases', label: 'Case Records (Read)', icon: FolderOpen },
        ];
    }
  };

  const navItems = getNavItems();

  const getRoleBadgeColor = (r) => {
    switch (r) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'case_manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reviewer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'qa_specialist':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'regulatory_affairs':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'data_entry':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <SessionExpiredModal />

      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-surface-border bg-white shadow-sm">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-surface-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm text-white">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              Drug Safety CMS
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              PV Case System
            </span>
          </div>
        </div>

        {/* Role Indicator Banner */}
        <div className="px-4 pt-3 pb-1">
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Active Workspace:</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeColor(role)}`}>
                {roleDetails?.displayName || role || 'User'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Links based on user role */}
        <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </div>
              {badge && (
                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Card & Sign Out */}
        <div className="border-t border-surface-border p-3 space-y-2 bg-slate-50/50">
          {user && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-xs uppercase shadow-sm">
                {user.name?.slice(0, 2) || 'US'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-800 truncate">{user.name}</span>
                <span className="text-[11px] text-slate-400 truncate">{user.email}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 border border-slate-200"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-surface-border bg-white/95 px-6 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-base font-bold text-slate-900">Drug Safety CMS</span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="text-xs font-semibold text-red-600 hover:text-red-800"
          >
            Sign Out
          </button>
        </header>

        {/* Page Container */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="p-6 lg:p-8 max-w-7xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
