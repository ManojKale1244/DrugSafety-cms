import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode,
  Upload,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Download,
  Copy,
  Check,
  Eye,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  FileCheck2,
  X,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import IcsrImportWizard from '../components/icsr/IcsrImportWizard';

export default function IcsrMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Detail Modal state
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAck, setSelectedAck] = useState([]);
  const [copied, setCopied] = useState(false);
  const [simulatingAck, setSimulatingAck] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (directionFilter) params.direction = directionFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/icsr/messages', { params });
      if (res.data.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching ICSR messages:', err);
    } finally {
      setLoading(false);
    }
  }, [directionFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleOpenDetail = async (msg) => {
    setSelectedMessage(msg);
    setDetailLoading(true);
    setCopied(false);
    try {
      const res = await api.get(`/icsr/messages/${msg._id}`);
      if (res.data.success) {
        setSelectedMessage(res.data.message);
        setSelectedAck(res.data.acknowledgements || []);
      }
    } catch (err) {
      console.error('Error fetching message details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyPayload = () => {
    if (!selectedMessage?.payload) return;
    navigator.clipboard.writeText(selectedMessage.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateAck = async (msgId) => {
    setSimulatingAck(true);
    try {
      const res = await api.post(`/icsr/gateway/mock-ack/${msgId}`, {
        ackCode: 'ACK_OK',
        note: 'Simulated Gateway ICSR ACK accepted with 0 errors.',
      });

      if (res.data.success) {
        setToastMessage('Gateway ACK successfully simulated!');
        setTimeout(() => setToastMessage(null), 3000);

        // Update active message in state
        if (selectedMessage && selectedMessage._id === msgId) {
          setSelectedMessage(res.data.message);
          setSelectedAck((prev) => [res.data.acknowledgement, ...prev]);
        }
        fetchMessages();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to simulate ACK');
    } finally {
      setSimulatingAck(false);
    }
  };

  // KPI Calculations
  const totalCount = messages.length;
  const inboundCount = messages.filter((m) => m.direction === 'IN').length;
  const outboundCount = messages.filter((m) => m.direction === 'OUT').length;
  const acknowledgedCount = messages.filter((m) => m.status === 'ACKNOWLEDGED').length;
  const pendingAckCount = messages.filter((m) => m.direction === 'OUT' && m.status !== 'ACKNOWLEDGED').length;

  return (
    <div className="space-y-6">
      {/* ── Toast Notification ─────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-900 text-white px-4 py-3 shadow-xl border border-emerald-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Persistent Compliance Banner ───────────────────────── */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed">
            <span className="font-bold uppercase tracking-wider block text-amber-900 mb-0.5">
              Successful export ≠ regulatory compliance.
            </span>
            The ICSR / E2B Gateway facilitates synthetic transmission and ingestion of adverse event reports using
            educational ICH E2B(R3)-aligned data models. Gateway simulations are educational and do not transmit data to
            live external regulatory portals.
          </div>
        </div>
      </div>

      {/* ── Top Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ICSR / E2B Transmission Gateway
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Electronic reporting ledger for ICH E2B(R3) XML & JSON clinical safety transmissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMessages}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowImportWizard(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import ICSR (E2B)</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Messages</span>
          <span className="text-xl font-bold text-slate-900 mt-0.5 block">{totalCount}</span>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-blue-700 block">Inbound (IN)</span>
          <span className="text-xl font-bold text-blue-900 mt-0.5 block">{inboundCount}</span>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-purple-700 block">Outbound (OUT)</span>
          <span className="text-xl font-bold text-purple-900 mt-0.5 block">{outboundCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-emerald-700 block">Acknowledged</span>
          <span className="text-xl font-bold text-emerald-900 mt-0.5 block">{acknowledgedCount}</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-amber-700 block">Pending Gateway ACK</span>
          <span className="text-xl font-bold text-amber-900 mt-0.5 block">{pendingAckCount}</span>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Filter */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setDirectionFilter('')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                directionFilter === '' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('IN')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                directionFilter === 'IN' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-slate-600'
              }`}
            >
              Inbound (IN)
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('OUT')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                directionFilter === 'OUT' ? 'bg-white shadow-xs text-purple-700 font-bold' : 'text-slate-600'
              }`}
            >
              Outbound (OUT)
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="PROCESSED">PROCESSED</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by MSG ID, Case, Intake..."
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* ── Messages Table ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Message ID</th>
                <th className="py-3 px-3">Dir</th>
                <th className="py-3 px-3">Format</th>
                <th className="py-3 px-4">Case / Intake Ref</th>
                <th className="py-3 px-4">Sender ➔ Receiver</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span>Loading transmission ledger…</span>
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileCode className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span className="font-medium text-slate-600 block">No ICSR messages found.</span>
                    <span className="text-slate-400 text-[11px]">
                      Export a case from the Case Details workspace or import an inbound XML/JSON file.
                    </span>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => {
                  const isOut = msg.direction === 'OUT';
                  const isAck = msg.status === 'ACKNOWLEDGED';

                  return (
                    <tr key={msg._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {msg.messageId}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isOut ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3" />
                          )}
                          {msg.direction}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
                          {msg.format}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700">
                        {msg.caseNumber ? (
                          <span className="text-brand-700 font-semibold">{msg.caseNumber}</span>
                        ) : msg.intakeNumber ? (
                          <span className="text-slate-600">{msg.intakeNumber}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-[11px] truncate max-w-[200px]">
                        <span className="font-medium">{msg.senderIdentifier}</span> ➔{' '}
                        <span>{msg.receiverIdentifier}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            msg.status === 'ACKNOWLEDGED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : msg.status === 'VALIDATED' || msg.status === 'PROCESSED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {msg.status === 'ACKNOWLEDGED' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                          {msg.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(msg.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(msg)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>

                        {isOut && !isAck && (
                          <button
                            type="button"
                            onClick={() => handleSimulateAck(msg._id)}
                            disabled={simulatingAck}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                            title="Simulate authority receipt acknowledgment"
                          >
                            <FileCheck2 className="h-3 w-3 text-emerald-600" />
                            <span>Mock ACK</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Message Detail Modal / Drawer ──────────────────────── */}
      {selectedMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    {selectedMessage.messageId}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase text-slate-700">
                      {selectedMessage.direction}BOUND ({selectedMessage.format})
                    </span>
                    <span>•</span>
                    <span>Status: <strong>{selectedMessage.status}</strong></span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[calc(85vh-200px)] overflow-y-auto">
              {/* Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Sender</span>
                  <span className="font-semibold text-slate-800">{selectedMessage.senderIdentifier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Receiver</span>
                  <span className="font-semibold text-slate-800">{selectedMessage.receiverIdentifier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference</span>
                  <span className="font-semibold text-brand-700 font-mono">
                    {selectedMessage.caseNumber || selectedMessage.intakeNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ACK Reference</span>
                  <span className="font-semibold text-emerald-700 font-mono">
                    {selectedMessage.ackRef || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Acknowledgement Status Panel */}
              {selectedAck.length > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Regulatory Gateway Acknowledgement Received</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-800">
                      {selectedAck[0].ackId}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                    {selectedAck[0].note || 'Acknowledgement recorded.'}
                  </p>
                </div>
              ) : selectedMessage.direction === 'OUT' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-amber-900">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Awaiting Authority E2B Gateway Acknowledgement (ACK)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulateAck(selectedMessage._id)}
                    disabled={simulatingAck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors shadow-xs"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span>Simulate Gateway ACK</span>
                  </button>
                </div>
              ) : null}

              {/* Payload Viewer */}
              <div className="relative rounded-xl border border-slate-200 bg-slate-900 text-slate-100 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-400 font-mono">
                  <span>Raw Transmission Payload ({selectedMessage.format})</span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-[340px] text-slate-200 whitespace-pre">
                  {selectedMessage.payload}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Wizard Modal ────────────────────────────────── */}
      <IcsrImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImportSuccess={() => {
          fetchMessages();
        }}
      />
    </div>
  );
}

