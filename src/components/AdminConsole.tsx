'use client';

import React, { useState, useEffect } from 'react';
import { staggerStyle } from '@/components/motion/tokens';
import { Listing, Dispute, AuditLog, Payment } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Target,
  MessageSquareWarning,
  RotateCcw,
} from 'lucide-react';

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState<'verification' | 'disputes' | 'reconciliation' | 'audit' | 'hypotheses'>('verification');
  const [listings, setListings] = useState<Listing[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [reasonsByListing, setReasonsByListing] = useState<Record<string, string>>({});
  const [disputeNotes, setDisputeNotes] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setAccessError(null);
    try {
      const [listingsRes, disputesRes, auditRes] = await Promise.all([
        fetch('/api/admin/listings'),
        fetch('/api/disputes'),
        fetch('/api/admin/audit-logs'),
      ]);

      if (listingsRes.status === 401 || listingsRes.status === 403) {
        setAccessError('Admin capability required to view Verification Queue & Trust logs.');
        return;
      }

      const listingsData = await listingsRes.json();
      const disputesData = await disputesRes.json();
      const auditData = await auditRes.json();

      if (listingsData.success) {
        setListings(listingsData.data || []);
      }
      if (disputesData.success) {
        setDisputes(disputesData.data || []);
      }
      if (auditData.success) {
        setAuditLogs(auditData.logs || []);
        setReconciliation(auditData.reconciliation || null);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setErrorBanner('Failed to fetch admin console data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateListing = async (listingId: string, status: Listing['status']) => {
    setStatusMessage(null);
    setErrorBanner(null);
    const reason = (reasonsByListing[listingId] || '').trim();

    if ((status === 'REJECTED' || status === 'NEEDS_INFO') && !reason) {
      setErrorBanner(`Please enter a clear feedback reason before marking listing as ${status.replace('_', ' ')}.`);
      return;
    }

    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: reason || 'Approved by Admin Trust & Safety' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || 'Failed to update listing status.');
        return;
      }
      setStatusMessage(`Listing updated to ${status.replace('_', ' ')} successfully.`);
      setReasonsByListing((prev) => ({ ...prev, [listingId]: '' }));
      fetchAdminData();
    } catch {
      setErrorBanner('Network error updating listing.');
    }
  };

  const handleResolveDispute = async (disputeId: string) => {
    setStatusMessage(null);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: disputeNotes || 'Investigated & resolved by Trust & Safety',
          refundAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || 'Failed to resolve dispute.');
        return;
      }
      setStatusMessage('Dispute resolved and logged to audit trail.');
      setDisputeNotes('');
      setRefundAmount(0);
      fetchAdminData();
    } catch {
      setErrorBanner('Network error resolving dispute.');
    }
  };

  if (!loading && accessError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-3">
          <ShieldCheck className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Restricted Admin Area</h1>
          <p className="text-xs text-slate-600">{accessError}</p>
        </div>
      </div>
    );
  }

  const queueListings = listings.filter((l) => l.status === 'PENDING_REVIEW' || l.status === 'NEEDS_INFO');
  const verifiedListings = listings.filter((l) => l.status === 'VERIFIED');
  const inactiveListings = listings.filter((l) => l.status === 'REJECTED' || l.status === 'SUSPENDED');
  const draftListings = listings.filter((l) => l.status === 'DRAFT');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-black">VPark Admin &amp; Trust Console</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Right-to-Rent Verification Queue (PRD 7.3), Restricted Document Audit Trail, Disputes &amp; Release Gates
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAdminData}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Queue
        </button>
      </div>

      {statusMessage && (
        <div role="status" className="p-3 bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-xl border border-emerald-200 animate-fade-in">
          {statusMessage}
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="p-3 bg-red-50 text-red-900 text-xs font-semibold rounded-xl border border-red-200 animate-fade-in">
          {errorBanner}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'verification'
              ? 'border-[#0A5CFF] text-[#0A5CFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Verification Queue ({queueListings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disputes')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'disputes'
              ? 'border-[#0A5CFF] text-[#0A5CFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Disputes ({disputes.filter((d) => d.status === 'OPEN').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'reconciliation'
              ? 'border-[#0A5CFF] text-[#0A5CFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Payments &amp; Ledger
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-[#0A5CFF] text-[#0A5CFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit Trail ({auditLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hypotheses')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'hypotheses'
              ? 'border-[#0A5CFF] text-[#0A5CFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target className="w-4 h-4 text-emerald-600" />
          R1 Release Progress
        </button>
      </div>

      {/* Tab 1: Verification Queue */}
      {activeTab === 'verification' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Pending &amp; Needs Info queue ({queueListings.length}) · Approved live ({verifiedListings.length}) · Drafts ({draftListings.length})
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Loading verification queue...
            </div>
          ) : queueListings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All submitted listings have been reviewed.
            </div>
          ) : (
            <div className="space-y-4">
              {queueListings.map((listing, index) => (
                <div
                  key={listing.id}
                  style={staggerStyle(index)}
                  className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs animate-fade-up"
                >
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            listing.status === 'NEEDS_INFO'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {listing.status === 'NEEDS_INFO' ? 'Needs Info' : 'Submitted · Pending Review'}
                        </span>
                        <span className="text-slate-500 font-semibold">
                          {listing.providerType} · {listing.category}
                        </span>
                        <span className="font-mono text-slate-400">
                          Pin: {listing.latitude.toFixed(4)}, {listing.longitude.toFixed(4)}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900">{listing.title}</h3>
                      <p className="text-slate-600">{listing.address}</p>
                      <p className="text-slate-500 text-[11px]">
                        Host: <strong>{listing.providerName}</strong> · Capacity: {listing.totalCapacity} bays · ₹{listing.pricing.hourlyRate}/hr · Photos: {listing.photos.length}
                      </p>
                      {listing.reviewReason && (
                        <p className="text-orange-700 font-semibold text-[11px]">
                          Previous Note: {listing.reviewReason}
                        </p>
                      )}
                    </div>

                    <div className="lg:w-80 space-y-2">
                      <input
                        type="text"
                        placeholder="Reviewer feedback (required for Needs Info / Reject)"
                        value={reasonsByListing[listing.id] || ''}
                        onChange={(e) =>
                          setReasonsByListing((prev) => ({ ...prev, [listing.id]: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateListing(listing.id, 'VERIFIED')}
                          className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateListing(listing.id, 'NEEDS_INFO')}
                          className="flex-1 px-3 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold flex items-center justify-center gap-1"
                        >
                          <MessageSquareWarning className="w-3.5 h-3.5" />
                          Needs Info
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateListing(listing.id, 'REJECTED')}
                          className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submitted Photos Preview */}
                  {listing.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {listing.photos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`${listing.title} proof view ${idx + 1}`}
                          className="w-28 h-20 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}

                  {/* Restricted Right-to-Rent Documents (PRD 7.3 — every view is audit-logged) */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 block">
                      Right-to-Rent Verification Files (Restricted &amp; Audit Logged on Open)
                    </span>
                    {listing.documents && listing.documents.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {listing.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-[#0A5CFF] flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block">{doc.docType.replace(/_/g, ' ')}</span>
                                <span className="text-[10px] text-slate-500 font-mono truncate block">
                                  {doc.fileName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#0A5CFF] flex items-center gap-1 flex-shrink-0 ml-2">
                              Inspect <ExternalLink className="w-3 h-3" />
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No verification proof files attached.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live Approved Listings */}
          <div>
            <h3 className="font-black text-slate-900 text-sm mb-3">Live Approved Listings ({verifiedListings.length})</h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
              {verifiedListings.map((l) => (
                <div key={l.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900">{l.title}</span>
                    <span className="text-slate-500 block text-[11px]">
                      {l.category} · ₹{l.pricing.hourlyRate}/hr · {l.locality} · Confirmed{' '}
                      {new Date(l.lastConfirmedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {l.isStale && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        Stale (&gt;30d)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateListing(l.id, 'SUSPENDED')}
                      className="px-3 py-1 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold border border-slate-200"
                    >
                      Suspend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suspended / Rejected Listings with Reinstate */}
          {inactiveListings.length > 0 && (
            <div>
              <h3 className="font-black text-slate-900 text-sm mb-3">
                Rejected &amp; Suspended Listings ({inactiveListings.length})
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                {inactiveListings.map((l) => (
                  <div key={l.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-slate-900">{l.title}</span>
                      <span className="text-slate-500 block text-[11px]">
                        Status: <strong>{l.status}</strong> {l.reviewReason ? `· Reason: ${l.reviewReason}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateListing(l.id, 'VERIFIED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reinstate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Disputes */}
      {activeTab === 'disputes' && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-xs text-slate-500">
            Complaints queue with {APP_CONFIG.disputeSlaHours}-hour target first response SLA.
          </div>

          {disputes.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Zero disputes logged.
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute, index) => (
                <div
                  key={dispute.id}
                  style={staggerStyle(index)}
                  className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs animate-fade-up"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                          {dispute.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-slate-400">Ref: {dispute.bookingReference}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-2">{dispute.description}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        SLA Deadline: {new Date(dispute.slaDeadline).toLocaleTimeString()} · Status: {dispute.status}
                      </p>
                    </div>

                    {dispute.status === 'OPEN' && (
                      <div className="space-y-2 sm:w-64">
                        <input
                          type="text"
                          placeholder="Resolution notes"
                          value={disputeNotes}
                          onChange={(e) => setDisputeNotes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Refund Amount (₹)"
                          onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleResolveDispute(dispute.id)}
                          className="w-full py-2 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold"
                        >
                          Resolve &amp; Issue Refund
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payments & Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6 text-xs animate-fade-in">
          {!reconciliation ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              No payment ledger entries loaded yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 block font-medium">Total Processed</span>
                  <span className="text-xl font-black text-slate-900">₹{reconciliation.totalProcessedVolume}</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 block font-medium">VPark Fee + Tax</span>
                  <span className="text-xl font-black text-emerald-700">₹{reconciliation.totalPlatformRevenue}</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 block font-medium">Host Payouts Owed</span>
                  <span className="text-xl font-black text-[#0A5CFF]">₹{reconciliation.totalProviderOwed}</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 block font-medium">Reconciliation</span>
                  <span className="text-xl font-black text-slate-900">{reconciliation.reconciliationRate}%</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800">
                  Gateway Transactions Audit Log
                </div>
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {reconciliation.payments.map((pay: Payment) => (
                    <div key={pay.id} className="p-4 flex items-center justify-between gap-4 font-mono text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900 block">{pay.referenceNumber}</span>
                        <span className="text-slate-500">
                          {pay.gatewayTransactionId} · {pay.method}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">₹{pay.amount.toFixed(2)}</span>
                        <span className="text-emerald-700">
                          Host: ₹{pay.providerEarning.toFixed(2)} · Fee+Tax: ₹{pay.platformCommission.toFixed(2)}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        {pay.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm text-xs animate-fade-in">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800">
            Security, Consent, Verification &amp; Admin Audit Log
          </div>
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log, index) => (
              <div
                key={log.id}
                style={staggerStyle(index, 30)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in transition-colors hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Target: {log.targetId}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400 flex-shrink-0">
                  <span className="block font-medium text-slate-600">{log.actorName}</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Honest Live Release Gates (PRD Section 4 & 11 — real counts only, zero fabricated numbers) */}
      {activeTab === 'hypotheses' && (
        <div className="space-y-4 text-xs animate-fade-in">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-slate-900 flex items-center justify-between">
            <div>
              <span className="font-black text-sm block">Yelahanka Foundation Release Gates (Live Database Metrics)</span>
              <span className="text-xs text-slate-600">
                Measured directly from live database tables — never placeholder or estimated metrics.
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#0A5CFF] text-white font-bold text-xs">
              R1 Live Tracker
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500">R1 Verified Supply Target</span>
              <div className="text-2xl font-black text-slate-900">
                {verifiedListings.length} / {APP_CONFIG.r1VerifiedListingTarget}
              </div>
              <p className="text-[11px] text-slate-600">
                Approved listings in DB ({queueListings.length} currently queued for review).
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500">Open Disputes / SLA</span>
              <div className="text-2xl font-black text-slate-900">
                {disputes.filter((d) => d.status === 'OPEN').length} open
              </div>
              <p className="text-[11px] text-slate-600">
                {disputes.length} total tickets logged under {APP_CONFIG.disputeSlaHours}h response target.
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500">Security &amp; Verification Events</span>
              <div className="text-2xl font-black text-slate-900">{auditLogs.length}</div>
              <p className="text-[11px] text-slate-600">
                Immutable audit entries recorded across OTP logins, consents, and document views.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
