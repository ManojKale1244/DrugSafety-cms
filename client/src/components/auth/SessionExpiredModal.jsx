import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SessionExpiredModal() {
  const { sessionExpired, setSessionExpired } = useAuth();

  if (!sessionExpired) return null;

  const handleRedirect = () => {
    setSessionExpired(false);
    window.location.href = '/login';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-7 w-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">Session Expired</h3>
          <p className="mt-2 text-sm text-slate-600">
            Your secure pharmacovigilance session has expired due to inactivity. Please sign in again to continue working.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleRedirect}
              className="btn-primary w-full"
            >
              <LogIn className="h-4 w-4" />
              Sign In Again
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
