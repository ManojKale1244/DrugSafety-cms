import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  X,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';

/**
 * Calculates exposure duration, latency (time-to-onset), and exposure status relative to reaction onset.
 */
function calculateLatency(prodStart, prodStop, rxnOnset) {
  if (!prodStart) {
    return {
      durationDays: null,
      timeToOnsetDays: null,
      status: 'UNKNOWN',
      label: 'Exposure start date unset',
      color: 'slate',
    };
  }

  const pStart = new Date(prodStart);
  const pStop = prodStop ? new Date(prodStop) : null;
  const rStart = rxnOnset ? new Date(rxnOnset) : null;

  let durationDays = null;
  if (pStop && !isNaN(pStop.getTime())) {
    durationDays = Math.max(0, Math.round((pStop.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (!rStart || isNaN(rStart.getTime())) {
    return {
      durationDays,
      timeToOnsetDays: null,
      status: 'NO_RXN_DATE',
      label: durationDays !== null ? `${durationDays}d exposure (No reaction onset date)` : 'Ongoing treatment',
      color: 'blue',
    };
  }

  const latencyDays = Math.round((rStart.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));

  if (latencyDays < 0) {
    return {
      durationDays,
      timeToOnsetDays: latencyDays,
      status: 'BEFORE_EXPOSURE',
      label: `Reaction occurred ${Math.abs(latencyDays)}d BEFORE initiation (Unlikely causal)`,
      color: 'rose',
    };
  }

  if (pStop && !isNaN(pStop.getTime()) && rStart.getTime() > pStop.getTime()) {
    const postStopDays = Math.round((rStart.getTime() - pStop.getTime()) / (1000 * 60 * 60 * 24));
    return {
      durationDays,
      timeToOnsetDays: latencyDays,
      status: 'AFTER_STOP',
      label: `Onset +${postStopDays}d after discontinuation (Latency: +${latencyDays}d)`,
      color: 'amber',
    };
  }

  return {
    durationDays,
    timeToOnsetDays: latencyDays,
    status: 'WITHIN_EXPOSURE',
    label: `Onset occurred +${latencyDays}d after start (Within exposure window)`,
    color: 'emerald',
  };
}

export default function CaseProductsEditor({ caseId, caseNumber, isClosed, onCaseUpdated }) {
  const [products, setProducts] = useState([]);
  const [rxnOnset, setRxnOnset] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueResults, setCatalogueResults] = useState([]);
  const [searchingCatalogue, setSearchingCatalogue] = useState(false);

  // Form State
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [role, setRole] = useState('Suspect');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [route, setRoute] = useState('Oral');
  const [indication, setIndication] = useState('');
  const [actionTaken, setActionTaken] = useState('UNKNOWN');
  const [startDate, setStartDate] = useState('');
  const [stopDate, setStopDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/cases/${caseId}/products`);
      if (res.data.success) {
        setProducts(res.data.products || []);
        if (res.data.rxnOnset) setRxnOnset(res.data.rxnOnset);
      }
    } catch (err) {
      console.error('Error fetching case products:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Search central catalogue for autocomplete
  useEffect(() => {
    if (!catalogueSearch || catalogueSearch.trim().length < 2) {
      setCatalogueResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCatalogue(true);
      try {
        const res = await api.get('/products', {
          params: { search: catalogueSearch.trim(), limit: 5, status: 'ACTIVE' },
        });
        if (res.data.success) {
          setCatalogueResults(res.data.products || []);
        }
      } catch (_err) {
        // ignore
      } finally {
        setSearchingCatalogue(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [catalogueSearch]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setProductId('');
    setProductName('');
    setGenericName('');
    setRole('Suspect');
    setDose('');
    setFrequency('Once Daily');
    setRoute('Oral');
    setIndication('');
    setActionTaken('UNKNOWN');
    setStartDate('');
    setStopDate('');
    setLotNumber('');
    setFormError(null);
    setCatalogueSearch('');
    setShowModal(true);
  };

  const handleOpenEditModal = (p) => {
    setEditingId(p._id);
    setProductId(p.productId || '');
    setProductName(p.productName || '');
    setGenericName(p.genericName || '');
    setRole(p.role || 'Suspect');
    setDose(p.dose || '');
    setFrequency(p.frequency || '');
    setRoute(p.route || 'Oral');
    setIndication(p.indication || '');
    setActionTaken(p.actionTaken || 'UNKNOWN');
    setStartDate(p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '');
    setStopDate(p.stopDate ? new Date(p.stopDate).toISOString().slice(0, 10) : '');
    setLotNumber(p.lotNumber || '');
    setFormError(null);
    setCatalogueSearch('');
    setShowModal(true);
  };

  const handleSelectFromCatalogue = (catProd) => {
    setProductId(catProd._id);
    setProductName(catProd.name);
    setGenericName(catProd.genericName || '');
    if (catProd.route) setRoute(catProd.route);
    if (catProd.strength) setDose(catProd.strength);
    setCatalogueResults([]);
    setCatalogueSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!productName.trim()) {
      setFormError('Product name is required.');
      return;
    }

    // Validate: stopDate >= startDate
    if (startDate && stopDate) {
      if (new Date(stopDate) < new Date(startDate)) {
        setFormError('Stop date cannot be earlier than start date.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: productId || null,
        productName: productName.trim(),
        genericName: genericName.trim(),
        role,
        dose: dose.trim(),
        frequency: frequency.trim(),
        route: route.trim(),
        indication: indication.trim(),
        actionTaken,
        startDate: startDate || null,
        stopDate: stopDate || null,
        lotNumber: lotNumber.trim(),
      };

      if (editingId) {
        await api.patch(`/cases/${caseId}/products/${editingId}`, payload);
      } else {
        await api.post(`/cases/${caseId}/products`, payload);
      }

      setShowModal(false);
      fetchProducts();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error saving product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (prodId, prodName) => {
    if (!window.confirm(`Are you sure you want to remove "${prodName}" from this safety case?`)) {
      return;
    }

    try {
      await api.delete(`/cases/${caseId}/products/${prodId}`);
      fetchProducts();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove product');
    }
  };

  return (
    <div className="card p-6 bg-white space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-brand-600" />
            <span>Medicinal Products & Exposure Timeline</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Suspect, concomitant, and interacting drugs with visual time-to-onset relative to reaction onset.
          </p>
        </div>

        {!isClosed && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* ── Reaction Onset Anchor Notice ───────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span>Reference Reaction Onset Date:</span>
          <strong className="font-mono text-slate-900">
            {rxnOnset ? new Date(rxnOnset).toLocaleDateString() : 'Not recorded'}
          </strong>
        </div>
        <span className="text-[11px] text-slate-500 italic">
          Exposure timelines below calculate latency relative to this anchor.
        </span>
      </div>

      {/* ── Products List with Timeline Visualizer ─────────────── */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
          <span className="text-xs">Loading case products…</span>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400 space-y-2">
          <Pill className="h-8 w-8 text-slate-300 mx-auto" />
          <span className="block font-semibold text-slate-700">No medicinal products recorded</span>
          <p className="max-w-xs mx-auto">
            Add at least one suspect medicinal product from the master catalogue or enter custom details.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => {
            const roleUpper = String(p.role || 'SUSPECT').toUpperCase();
            const latency = calculateLatency(p.startDate, p.stopDate, rxnOnset);

            return (
              <div
                key={p._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 hover:border-slate-300 transition-all"
              >
                {/* Product Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-slate-900">{p.productName}</span>

                    {p.genericName && (
                      <span className="text-xs text-slate-500 italic font-mono">
                        ({p.genericName})
                      </span>
                    )}

                    {/* Role Pill */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        roleUpper === 'SUSPECT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : roleUpper === 'INTERACTING'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {p.role}
                    </span>

                    {/* Action Taken Pill */}
                    {p.actionTaken && p.actionTaken !== 'UNKNOWN' && (
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        Action: {p.actionTaken.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {!isClosed && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(p)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit product details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p._id, p.productName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove product from case"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Dose / Frequency:</span>
                    <strong className="text-slate-800">
                      {p.dose ? `${p.dose} ${p.frequency || ''}`.trim() : 'Unspecified'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Route:</span>
                    <strong className="text-slate-800">{p.route || 'Oral'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Indication:</span>
                    <strong className="text-slate-800">{p.indication || 'Unspecified'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Lot / Batch Number:</span>
                    <strong className="text-slate-800 font-mono">{p.lotNumber || '—'}</strong>
                  </div>
                </div>

                {/* ── VISUAL TIME-TO-ONSET TIMELINE BAR ──────────────── */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-brand-600" />
                      <span>Exposure Window & Latency:</span>
                    </div>

                    {/* Latency Tag */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        latency.color === 'emerald'
                          ? 'bg-emerald-100 text-emerald-800'
                          : latency.color === 'rose'
                          ? 'bg-rose-100 text-rose-800'
                          : latency.color === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {latency.color === 'emerald' && <CheckCircle2 className="h-3 w-3" />}
                      {latency.color === 'rose' && <AlertTriangle className="h-3 w-3" />}
                      <span>{latency.label}</span>
                    </span>
                  </div>

                  {/* Horizontal Bar Graphic */}
                  <div className="space-y-1.5 pt-1">
                    <div className="relative h-6 rounded-lg bg-slate-100 flex items-center px-2 overflow-hidden border border-slate-200">
                      {/* Active exposure span */}
                      <div className="h-2.5 w-full rounded bg-brand-500/70" />

                      {/* Reaction onset indicator flag */}
                      {rxnOnset && p.startDate && (
                        <div
                          className="absolute flex flex-col items-center"
                          style={{
                            left:
                              latency.status === 'BEFORE_EXPOSURE'
                                ? '5%'
                                : latency.status === 'AFTER_STOP'
                                ? '92%'
                                : '50%',
                          }}
                        >
                          <div className="h-5 w-0.5 bg-rose-600" />
                          <div className="h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white -mt-1" />
                        </div>
                      )}
                    </div>

                    {/* Timeline Date Labels */}
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>
                        Start: {p.startDate ? new Date(p.startDate).toLocaleDateString() : 'Unknown'}
                      </span>
                      {rxnOnset && (
                        <span className="text-rose-700 font-semibold">
                          ▲ Reaction: {new Date(rxnOnset).toLocaleDateString()}
                        </span>
                      )}
                      <span>
                        Stop: {p.stopDate ? new Date(p.stopDate).toLocaleDateString() : 'Ongoing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Add / Edit Product ──────────────────────────── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Case Product' : 'Add Product to Safety Case'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[calc(85vh-140px)] overflow-y-auto">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Autocomplete from Catalogue */}
              {!editingId && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 space-y-2">
                  <label className="font-semibold text-brand-950 block">
                    Pick from Central Drug Catalogue (Autocomplete):
                  </label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogueSearch}
                      onChange={(e) => setCatalogueSearch(e.target.value)}
                      placeholder="Type brand name or generic INN..."
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-white"
                    />
                  </div>

                  {catalogueResults.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-36 overflow-y-auto shadow-sm">
                      {catalogueResults.map((cat) => (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => handleSelectFromCatalogue(cat)}
                          className="w-full text-left p-2 hover:bg-brand-50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <strong className="text-slate-900 block">{cat.name}</strong>
                            <span className="text-[11px] text-slate-500">
                              {cat.genericName} • {cat.strength} ({cat.dosageForm})
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Product / Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. CardioMax 50mg"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Generic Name (INN)</label>
                  <input
                    type="text"
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder="e.g. Metoprolol"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Drug Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="Suspect">Suspect (Primary/Secondary)</option>
                    <option value="Concomitant">Concomitant</option>
                    <option value="Interacting">Interacting</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Route of Administration</label>
                  <input
                    type="text"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    placeholder="Oral, Intravenous, Topical"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Dose & Unit</label>
                  <input
                    type="text"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    placeholder="e.g. 50mg, 10ml"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Frequency</label>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    placeholder="Once Daily, BID, PRN"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Indication</label>
                  <input
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="Hypertension, Infection, etc."
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Action Taken With Drug</label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="UNKNOWN">Unknown</option>
                    <option value="DRUG_WITHDRAWN">Drug Withdrawn (Dechallenge)</option>
                    <option value="DOSE_REDUCED">Dose Reduced</option>
                    <option value="DOSE_INCREASED">Dose Increased</option>
                    <option value="DOSE_NOT_CHANGED">Dose Not Changed</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              </div>

              {/* Exposure Dates */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Exposure Period (Start Date & Stop Date)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="exposureStartDate" className="text-slate-600 block mb-1">
                      Exposure Start Date:
                    </label>
                    <input
                      id="exposureStartDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="exposureStopDate" className="text-slate-600 block mb-1">
                      Exposure Stop Date:
                    </label>
                    <input
                      id="exposureStopDate"
                      type="date"
                      value={stopDate}
                      onChange={(e) => setStopDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 bg-white"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Leave stop date empty if drug treatment was ongoing at time of reaction onset.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Lot / Batch Number</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="e.g. BATCH-2026-X1"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-white font-semibold hover:bg-brand-500 shadow-xs flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{editingId ? 'Save Changes' : 'Add Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
