import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 404 — Not Found page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden="true" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900">404</h1>
        <p className="mt-2 text-lg text-slate-600">Page not found</p>
        <p className="mt-1 text-sm text-slate-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn-primary mt-8 inline-flex">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
