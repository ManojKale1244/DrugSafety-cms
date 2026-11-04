import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import BaseLayout from '@/components/layout/BaseLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Cases from '@/pages/Cases';
import CaseDetails from '@/pages/CaseDetails';
import Intakes from '@/pages/Intakes';
import IntakeDetails from '@/pages/IntakeDetails';
import DuplicateQueue from '@/pages/DuplicateQueue';
import DuplicateCompare from '@/pages/DuplicateCompare';
import Users from '@/pages/Users';
import ReportingCalendar from '@/pages/ReportingCalendar';
import IcsrMessages from '@/pages/IcsrMessages';
import Products from '@/pages/Products';
import ComplianceDashboard from '@/pages/ComplianceDashboard';
import AggregateReports from '@/pages/AggregateReports';
import Documents from '@/pages/Documents';
import Forbidden from '@/pages/Forbidden';
import NotFound from '@/pages/NotFound';

/**
 * Root Router Configuration
 */
export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />

      {/* Authenticated routes wrapped in BaseLayout */}
      <Route
        element={
          <ProtectedRoute>
            <BaseLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/intakes" element={<Intakes />} />
        <Route path="/intakes/:id" element={<IntakeDetails />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:caseId" element={<CaseDetails />} />
        <Route path="/duplicates" element={<DuplicateQueue />} />
        <Route path="/duplicates/:id" element={<DuplicateCompare />} />

        {/* Admin only route */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Fallback for other role placeholder routes */}
        <Route path="/workload" element={<Dashboard />} />
        <Route path="/action-items" element={<Dashboard />} />
        <Route path="/reports" element={<ReportingCalendar />} />
        <Route path="/icsr" element={<IcsrMessages />} />
        <Route path="/products" element={<Products />} />
        <Route path="/compliance" element={<ComplianceDashboard />} />
        <Route path="/aggregate-reports" element={<AggregateReports />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/medical-review" element={<Dashboard />} />
        <Route path="/contact-logs" element={<Dashboard />} />
        <Route path="/admin/audits" element={<Dashboard />} />
      </Route>

      {/* Redirects & fallback */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
