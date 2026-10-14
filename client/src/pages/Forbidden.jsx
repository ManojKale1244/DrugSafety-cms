import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Forbidden() {
  const { user, roleDetails } = useAuth();

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="card max-w-lg p-8 text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-sm">
          <ShieldAlert className="h-10 w-10" />
        </div>

        <span className="badge badge-overdue mb-3">HTTP 403 — Forbidden</span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Access Denied</h1>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          You do not have the required role or permissions to access this administrative module or resource.
        </p>

        {user && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Logged in as:</span>
              <span className="font-semibold text-slate-900">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Assigned Role:</span>
              <span className="font-semibold text-indigo-700">{roleDetails?.displayName || user.role?.name}</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link to="/dashboard" className="btn-primary">
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
