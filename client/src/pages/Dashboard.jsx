import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import KpiCard from '../components/dashboard/KpiCard';
import StatusDonutChart from '../components/dashboard/StatusDonutChart';
import IntakeTrendChart from '../components/dashboard/IntakeTrendChart';
import WorkloadBarChart from '../components/dashboard/WorkloadBarChart';
import ReportingTimeline from '../components/dashboard/ReportingTimeline';
import MyTasksPanel from '../components/dashboard/MyTasksPanel';
import RecentActivityFeed from '../components/dashboard/RecentActivityFeed';
import QuickLaunchBar from '../components/dashboard/QuickLaunchBar';

export default function Dashboard() {
  const { user, role, roleDetails } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);

  const timerRef = useRef(null);

  // Fetch dashboard summary
  const fetchSummary = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await api.get('/dashboard/summary', {
        params: { timeRange },
      });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSecondsUntilRefresh(60);
    }
  }, [timeRange]);

  // Initial load & when timeRange changes
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Auto-refresh countdown every 60s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchSummary(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [fetchSummary]);

  // Dynamic greeting based on role
  const getGreeting = () => {
    const firstName = user?.name?.split(' ')[0] || 'Safety Specialist';
    switch (role) {
      case 'reviewer':
        return {
          title: `Welcome back, ${firstName}`,
          focus: 'Your queue today: Review pending adverse event causality and urgent action items.',
        };
      case 'case_manager':
        return {
          title: `Safety Operations Overview, ${firstName}`,
          focus: 'Workload distribution, expedited regulatory deadlines, and active team triage.',
        };
      case 'admin':
        return {
          title: `System Administration Console, ${firstName}`,
          focus: 'Enterprise safety posture, active user sessions, and compliance audit trail.',
        };
      case 'data_entry':
        return {
          title: `Adverse Event Intake Queue, ${firstName}`,
          focus: 'Triage newly received reports, log contacts, and verify reporter records.',
        };
      case 'qa_specialist':
        return {
          title: `Quality Gate & Compliance Oversight, ${firstName}`,
          focus: 'Quality review checkpoints, regulatory submission audits, and closed-case verification.',
        };
      case 'regulatory_affairs':
        return {
          title: `Periodic & Expedited Submissions, ${firstName}`,
          focus: '7/15-day expedited deadlines and health authority transmission queues.',
        };
      default:
        return {
          title: `Hello, ${firstName}`,
          focus: 'Pharmacovigilance adverse event dashboard.',
        };
    }
  };

  const greeting = getGreeting();
  const summary = data?.summary || {};
  const isProcessor = ['reviewer', 'data_entry', 'viewer'].includes(role);

  return (
    <div className="space-y-6">
      {/* ── Top Header & Global Controls ─────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="h-4 w-4" />
            {roleDetails?.displayName || role || 'Safety Member'}
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
            {greeting.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {greeting.focus}
          </p>
        </div>

        {/* Time Range Selector & Auto-Refresh Badge */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
            {['7d', '14d', '30d', '90d'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  timeRange === range
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Auto-refreshes every 60s"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            <span className="hidden sm:inline">Refresh ({secondsUntilRefresh}s)</span>
          </button>
        </div>
      </div>

      {/* ── Quick Launch Bar ─────────────────────────────────── */}
      <QuickLaunchBar />

      {/* ── Error State ──────────────────────────────────────── */}
      {error && (
        <div className="card p-6 border-red-200 bg-red-50 text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Failed to Load Dashboard Metrics</h3>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchSummary()}
            className="btn-primary bg-red-600 hover:bg-red-700 text-xs py-2 px-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────────── */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse h-28 bg-slate-100" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="card p-6 h-80 animate-pulse bg-slate-100 lg:col-span-8" />
            <div className="card p-6 h-80 animate-pulse bg-slate-100 lg:col-span-4" />
          </div>
        </div>
      )}

      {/* ── Dashboard Content ────────────────────────────────── */}
      {data && (
        <>
          {/* Row of 6 Animated KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              title={isProcessor ? 'My Active Cases' : 'Total Cases'}
              value={summary.totalCases || 0}
              delta="+14%"
              isPositive={true}
              subtitle="All registered adverse reports"
              icon={FolderOpen}
              colorScheme="blue"
              onClick={() => navigate('/cases')}
            />

            <KpiCard
              title="Medical Review"
              value={summary.awaitingMedicalReview || 0}
              delta="Priority"
              isPositive={false}
              subtitle="Causality analysis required"
              icon={ClipboardList}
              colorScheme="purple"
              onClick={() => navigate('/cases?status=medical_review')}
            />

            <KpiCard
              title="Quality Review"
              value={summary.awaitingQualityReview || 0}
              subtitle="Compliance sign-off pending"
              icon={ShieldCheck}
              colorScheme="amber"
              onClick={() => navigate('/cases?status=quality_review')}
            />

            <KpiCard
              title="Overdue Actions"
              value={summary.overdueActions || 0}
              delta="23:59 IST"
              isPositive={false}
              subtitle="Expired deadline tasks"
              icon={AlertTriangle}
              colorScheme="red"
              onClick={() => navigate('/cases')}
            />

            <KpiCard
              title="Reporting (7d)"
              value={summary.dueForReporting7d || 0}
              delta="Expedited"
              isPositive={false}
              subtitle="Statutory 7/15-day window"
              icon={Clock}
              colorScheme="amber"
              onClick={() => navigate('/cases')}
            />

            <KpiCard
              title="Completed Cases"
              value={summary.completedCases || 0}
              delta="+8%"
              isPositive={true}
              subtitle="Fully signed & archived"
              icon={CheckCircle2}
              colorScheme="emerald"
              onClick={() => navigate('/cases?status=completed')}
            />
          </div>

          {/* ── Main Dynamic Grid: Role Specific Layout ────────── */}
          {isProcessor ? (
            /* ── Processor Layout: Queue & My Tasks First ─────── */
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <MyTasksPanel tasks={data.myTasks || []} />
                </div>
                <div className="lg:col-span-5">
                  <StatusDonutChart data={data.casesByStatus || []} />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <IntakeTrendChart data={data.trend14d || []} />
                </div>
                <div className="lg:col-span-4">
                  <RecentActivityFeed activities={data.recentActivity || []} />
                </div>
              </div>
            </div>
          ) : (
            /* ── Manager / Admin Layout: Team Workload & Reporting First ── */
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <IntakeTrendChart data={data.trend14d || []} />
                </div>
                <div className="lg:col-span-4">
                  <StatusDonutChart data={data.casesByStatus || []} />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <WorkloadBarChart
                    data={data.workloadPerUser || []}
                    isGlobalScope={data.isGlobalScope}
                  />
                </div>
                <div className="lg:col-span-5">
                  <ReportingTimeline dueCasesCount={summary.dueForReporting7d || 0} />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <MyTasksPanel tasks={data.myTasks || []} />
                </div>
                <div className="lg:col-span-6">
                  <RecentActivityFeed activities={data.recentActivity || []} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
