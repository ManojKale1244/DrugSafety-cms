import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SessionExpiredModal from '../auth/SessionExpiredModal';

export default function BaseLayout() {
  const location = useLocation();
  const { user, role, roleDetails, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

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

  const NavLinksList = ({ onItemClick }) => (
    <nav className="flex-1 space-y-1.5 px-3 py-3 overflow-y-auto custom-scrollbar" aria-label="Main navigation">
      {navItems.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onItemClick}
          className={({ isActive }) =>
            `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" aria-hidden="true" />
            <span>{label}</span>
          </div>
          {badge && (
            <span className="rounded-md bg-brand-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <SessionExpiredModal />

      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-surface-border bg-white shadow-xs">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-surface-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm text-white ring-2 ring-brand-100">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              Drug Safety CMS
            </span>
            <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider">
              PV Case System
            </span>
          </div>
        </div>

        {/* Role Indicator Banner */}
        <div className="px-4 pt-3 pb-1">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Workspace:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeColor(role)}`}>
                {roleDetails?.displayName || role || 'User'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Links based on user role */}
        <NavLinksList />

        {/* User Card & Sign Out */}
        <div className="border-t border-surface-border p-3.5 space-y-2 bg-slate-50/60">
          {user && (
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white border border-slate-200/60 shadow-2xs">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-xs uppercase shadow-xs">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 hover:border-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 border border-slate-200 bg-white"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sign Out
          </button>

          <p className="text-[10px] text-slate-400 text-center pt-1 font-medium leading-tight">
            © {new Date().getFullYear()} Drug Safety CMS — Pharmacovigilance Platform
          </p>
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer & Overlay ───────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
              aria-hidden="true"
            />

            {/* Slide-out Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl border-r border-slate-200 lg:hidden"
              aria-label="Mobile Navigation"
            >
              {/* Drawer Header */}
              <div className="flex h-16 items-center justify-between border-b border-surface-border px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                    <Shield className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold tracking-tight text-slate-900">
                      Drug Safety CMS
                    </span>
                    <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider">
                      PV Case System
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Role Indicator */}
              <div className="px-4 pt-3 pb-1">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Workspace:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeColor(role)}`}>
                      {roleDetails?.displayName || role || 'User'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Links */}
              <NavLinksList onItemClick={() => setMobileMenuOpen(false)} />

              {/* User Profile & Sign Out Footer */}
              <div className="border-t border-surface-border p-4 space-y-2.5 bg-slate-50/70">
                {user && (
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-xs uppercase shadow-xs">
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-slate-200 bg-white"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Sign Out
                </button>

                <p className="text-[10px] text-slate-400 text-center pt-1 font-medium leading-tight">
                  © {new Date().getFullYear()} Drug Safety CMS — Pharmacovigilance Platform
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ───────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-surface-border bg-white/90 px-4 sm:px-6 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-2xs">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold text-slate-900 tracking-tight">Drug Safety CMS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadgeColor(role)}`}>
              {roleDetails?.displayName || role || 'User'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors px-2 py-1"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Responsive Page Container */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
