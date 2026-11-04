import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ExternalLink,
  Layers,
  Archive,
} from 'lucide-react';
import api from '../services/api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');

  // Drawer / Modal States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [submittingRetire, setSubmittingRetire] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formGeneric, setFormGeneric] = useState('');
  const [formStrength, setFormStrength] = useState('');
  const [formDosageForm, setFormDosageForm] = useState('Tablet');
  const [formRoute, setFormRoute] = useState('Oral');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formClassification, setFormClassification] = useState('Prescription');
  const [formAtcCode, setFormAtcCode] = useState('');
  const [formNdc, setFormNdc] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIngredients, setFormIngredients] = useState([{ name: '', strength: '' }]);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formError, setFormError] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (classificationFilter) params.classification = classificationFilter;

      const res = await api.get('/products', { params });
      if (res.data.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, classificationFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenDetail = async (prod) => {
    setSelectedProduct(prod);
    setDetailLoading(true);
    try {
      const res = await api.get(`/products/${prod._id}`);
      if (res.data.success) {
        setDetailData(res.data);
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormGeneric('');
    setFormStrength('');
    setFormDosageForm('Tablet');
    setFormRoute('Oral');
    setFormManufacturer('');
    setFormClassification('Prescription');
    setFormAtcCode('');
    setFormNdc('');
    setFormDescription('');
    setFormIngredients([{ name: '', strength: '' }]);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    setFormName(prod.name || '');
    setFormGeneric(prod.genericName || '');
    setFormStrength(prod.strength || '');
    setFormDosageForm(prod.dosageForm || 'Tablet');
    setFormRoute(prod.route || 'Oral');
    setFormManufacturer(prod.manufacturer || '');
    setFormClassification(prod.classification || 'Prescription');
    setFormAtcCode(prod.identifiers?.atcCode || '');
    setFormNdc(prod.identifiers?.ndc || '');
    setFormDescription(prod.description || '');
    setFormIngredients(
      prod.ingredients?.length > 0 ? prod.ingredients : [{ name: '', strength: '' }]
    );
    setFormError(null);
    setShowFormModal(true);
  };

  const handleAddIngredientRow = () => {
    setFormIngredients([...formIngredients, { name: '', strength: '' }]);
  };

  const handleRemoveIngredientRow = (idx) => {
    setFormIngredients(formIngredients.filter((_, i) => i !== idx));
  };

  const handleIngredientChange = (idx, field, val) => {
    const updated = [...formIngredients];
    updated[idx][field] = val;
    setFormIngredients(updated);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formGeneric.trim()) {
      setFormError('Product Name and Generic Name are required.');
      return;
    }

    setSubmittingForm(true);
    setFormError(null);
    try {
      const validIngredients = formIngredients.filter((ing) => ing.name.trim() !== '');

      const payload = {
        name: formName.trim(),
        genericName: formGeneric.trim(),
        strength: formStrength.trim(),
        dosageForm: formDosageForm,
        route: formRoute,
        manufacturer: formManufacturer.trim(),
        classification: formClassification,
        identifiers: {
          atcCode: formAtcCode.trim(),
          ndc: formNdc.trim(),
        },
        description: formDescription.trim(),
        ingredients: validIngredients,
      };

      if (editingProduct) {
        await api.patch(`/products/${editingProduct._id}`, payload);
        showToast('Product updated successfully');
      } else {
        await api.post('/products', payload);
        showToast('New product added to catalogue');
      }

      setShowFormModal(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error saving product');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleRetireClick = (prod) => {
    setSelectedProduct(prod);
    setRetireReason('Decommissioned from safety formulary');
    setShowRetireModal(true);
  };

  const handleConfirmRetire = async () => {
    if (!selectedProduct) return;
    setSubmittingRetire(true);
    try {
      await api.post(`/products/${selectedProduct._id}/retire`, {
        reason: retireReason.trim() || 'Decommissioned from safety catalogue',
      });
      showToast(`Product ${selectedProduct.name} retired successfully`);
      setShowRetireModal(false);
      fetchProducts();
      if (detailData && detailData.product._id === selectedProduct._id) {
        handleOpenDetail(selectedProduct);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to retire product');
    } finally {
      setSubmittingRetire(false);
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Attempt deletion of catalogue entry "${prod.name}"?`)) {
      return;
    }

    try {
      const res = await api.delete(`/products/${prod._id}`);
      showToast(res.data.message || 'Product deleted');
      fetchProducts();
    } catch (err) {
      const data = err.response?.data;
      if (data?.isReferenced) {
        alert(
          `Cannot delete "${prod.name}"!\n\nThis drug is referenced in ${data.usageCount} safety case(s). To preserve regulatory integrity, please use the "Retire" action instead.`
        );
      } else {
        alert(data?.message || err.message || 'Failed to delete product');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Pill className="h-6 w-6 text-brand-600" />
            <span>Medicinal Product Catalogue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Master pharmaceutical formulary maintaining drug nomenclature, active ingredients, dosage forms, and ATC
            classifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchProducts}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Catalogue Drug</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RETIRED">RETIRED</option>
            <option value="INVESTIGATIONAL">INVESTIGATIONAL</option>
          </select>

          {/* Classification Filter */}
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-500"
          >
            <option value="">All Classifications</option>
            <option value="Prescription">Prescription (Rx)</option>
            <option value="OTC">Over-the-Counter (OTC)</option>
            <option value="Vaccine">Vaccine</option>
            <option value="Biologic">Biologic</option>
            <option value="Investigational">Investigational</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Brand Name, INN, ATC Code..."
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500"
          />
        </div>
      </div>

      {/* ── Products Table ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Code / Brand Name</th>
                <th className="py-3 px-4">Generic Name (INN)</th>
                <th className="py-3 px-3">Strength & Form</th>
                <th className="py-3 px-3">Route</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-3">ATC Code</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Cases</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span>Loading catalogue drugs…</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Pill className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span className="font-semibold text-slate-700 block">No products found</span>
                    <span className="text-slate-400 text-[11px]">
                      Add products to the catalogue to enable auto-completion during case intake.
                    </span>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isRetired = p.status === 'RETIRED';

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.productCode}
                          </span>
                          <strong className="font-semibold text-slate-900">{p.name}</strong>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                        {p.genericName}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {p.strength ? `${p.strength} ${p.dosageForm}` : p.dosageForm}
                      </td>

                      <td className="py-3 px-3 text-slate-600">{p.route || 'Oral'}</td>

                      <td className="py-3 px-4 text-slate-600 text-[11px] truncate max-w-[150px]">
                        {p.manufacturer || '—'}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {p.identifiers?.atcCode || '—'}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isRetired
                              ? 'bg-slate-100 text-slate-600 border border-slate-300'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full font-bold text-[11px] ${
                            p.usageCount > 0
                              ? 'bg-brand-50 text-brand-700 border border-brand-200'
                              : 'text-slate-400'
                          }`}
                        >
                          {p.usageCount || 0}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(p)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>

                        {!isRetired && (
                          <button
                            type="button"
                            onClick={() => handleRetireClick(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                            title="Decommission drug from active selection"
                          >
                            <Archive className="h-3 w-3" />
                            <span>Retire</span>
                          </button>
                        )}

                        {p.usageCount === 0 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete unreferenced entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* ── PRODUCT DETAIL DRAWER / MODAL ──────────────────────── */}
      {selectedProduct && !showRetireModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedProduct.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedProduct.productCode} • {selectedProduct.genericName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(85vh-160px)] overflow-y-auto text-xs">
              {/* Status & Classification Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-slate-900">{selectedProduct.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Classification</span>
                  <span className="font-bold text-slate-900">{selectedProduct.classification}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ATC Code</span>
                  <span className="font-mono font-bold text-brand-700">
                    {selectedProduct.identifiers?.atcCode || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cases Using Drug</span>
                  <span className="font-bold text-slate-900">
                    {detailData?.usageCount ?? selectedProduct.usageCount ?? 0}
                  </span>
                </div>
              </div>

              {/* Formulation Specifications */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <span className="font-bold text-slate-800 block text-xs">Pharmaceutical Specifications</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Strength:</span>
                    <strong className="text-slate-800">{selectedProduct.strength || 'Unspecified'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Dosage Form:</span>
                    <strong className="text-slate-800">{selectedProduct.dosageForm}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Route:</span>
                    <strong className="text-slate-800">{selectedProduct.route}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Manufacturer:</span>
                    <strong className="text-slate-800">{selectedProduct.manufacturer || 'Unspecified'}</strong>
                  </div>
                </div>
              </div>

              {/* Active Ingredients */}
              {selectedProduct.ingredients?.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                  <span className="font-bold text-slate-800 block text-xs">Active Ingredients</span>
                  <div className="space-y-1.5">
                    {selectedProduct.ingredients.map((ing, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100"
                      >
                        <span className="font-semibold text-slate-800">{ing.name}</span>
                        <span className="font-mono text-slate-500">{ing.strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Safety Cases */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <span className="font-bold text-slate-800 block text-xs">
                  Safety Cases Linked to this Product ({detailData?.usageCount || 0})
                </span>
                {detailLoading ? (
                  <div className="py-4 text-center text-slate-400">Loading case links…</div>
                ) : detailData?.linkedCases?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailData.linkedCases.map((c) => (
                      <div
                        key={c._id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <span className="font-mono font-bold text-brand-700">{c.caseNumber}</span>
                        <span className="text-slate-500 text-[11px]">
                          Status: <strong>{c.status}</strong> • Seriousness: {c.seriousness}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic">No safety cases currently reference this drug.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <div>
                {selectedProduct.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => handleRetireClick(selectedProduct)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Retire Product</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Retire Product ──────────────────────────────── */}
      {showRetireModal && selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-amber-50">
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <Archive className="h-4 w-4 text-amber-700" />
                <span>Retire Product from Active Formulary</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRetireModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900 leading-relaxed">
                <strong>Audit Compliance Guarantee:</strong> Retiring &quot;{selectedProduct.name}&quot; preserves all
                historical safety case records, causality links, and regulatory submissions while disabling this entry
                for new case selections.
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Retirement Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={retireReason}
                  onChange={(e) => setRetireReason(e.target.value)}
                  placeholder="e.g. Market withdrawal, superseded by reformulation, regulatory recall..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRetireModal(false)}
                  className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRetire}
                  disabled={submittingRetire}
                  className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-white font-semibold hover:bg-amber-500 shadow-xs flex items-center gap-1.5"
                >
                  {submittingRetire ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                  <span>Confirm Retirement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Create / Edit Product ───────────────────────── */}
      {showFormModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Catalogue Drug' : 'Add New Drug to Catalogue'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs max-h-[calc(85vh-140px)] overflow-y-auto">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand / Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. CardioMax 50mg"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Generic Name (INN) *</label>
                  <input
                    type="text"
                    required
                    value={formGeneric}
                    onChange={(e) => setFormGeneric(e.target.value)}
                    placeholder="e.g. Metoprolol Succinate"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Strength</label>
                  <input
                    type="text"
                    value={formStrength}
                    onChange={(e) => setFormStrength(e.target.value)}
                    placeholder="e.g. 50mg, 10mg/ml"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Dosage Form</label>
                  <input
                    type="text"
                    value={formDosageForm}
                    onChange={(e) => setFormDosageForm(e.target.value)}
                    placeholder="Tablet, Capsule, Liquid"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Route</label>
                  <input
                    type="text"
                    value={formRoute}
                    onChange={(e) => setFormRoute(e.target.value)}
                    placeholder="Oral, IV, Topical"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    placeholder="e.g. PharmaCorp Ltd"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Classification</label>
                  <select
                    value={formClassification}
                    onChange={(e) => setFormClassification(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="Prescription">Prescription (Rx)</option>
                    <option value="OTC">Over-the-Counter (OTC)</option>
                    <option value="Vaccine">Vaccine</option>
                    <option value="Biologic">Biologic</option>
                    <option value="Investigational">Investigational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ATC Code</label>
                  <input
                    type="text"
                    value={formAtcCode}
                    onChange={(e) => setFormAtcCode(e.target.value)}
                    placeholder="e.g. C07AB02"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">NDC Identifier</label>
                  <input
                    type="text"
                    value={formNdc}
                    onChange={(e) => setFormNdc(e.target.value)}
                    placeholder="e.g. 00000-000-00"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Dynamic Active Ingredients */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 block text-xs">Active Ingredients</span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                  >
                    + Add Ingredient
                  </button>
                </div>

                {formIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ingredient Name"
                      value={ing.name}
                      onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 p-1.5 text-xs text-slate-800 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Strength (e.g. 50mg)"
                      value={ing.strength}
                      onChange={(e) => handleIngredientChange(idx, 'strength', e.target.value)}
                      className="w-36 rounded-lg border border-slate-300 p-1.5 text-xs text-slate-800 bg-white"
                    />
                    {formIngredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-white font-semibold hover:bg-brand-500 shadow-xs flex items-center gap-1.5"
                >
                  {submittingForm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{editingProduct ? 'Update Product' : 'Add Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

