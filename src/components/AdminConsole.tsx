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
        <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline p-8 shadow-sm space-y-3">
          <ShieldCheck className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto" />
          <h1 className="text-xl font-black text-slate-900 dark:text-ink">Restricted Admin Area</h1>
          <p className="text-xs text-slate-600 dark:text-ink-2">{accessError}</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 dark:bg-surface-alt dark:border dark:border-hairline text-white dark:text-ink p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-black">VPark Admin &amp; Trust Console</h1>
          </div>
          <p className="text-xs text-slate-400 dark:text-ink-3 mt-1">
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
        <div role="status" className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-500/30 animate-fade-in">
          {statusMessage}
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="p-3 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-300 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-500/30 animate-fade-in">
          {errorBanner}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-200 dark:border-hairline gap-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'verification'
              ? 'border-[#0A5CFF] text-[#0A5CFF] dark:text-[var(--transit-accent)]'
              : 'border-transparent text-slate-500 dark:text-ink-3 hover:text-slate-800 dark:hover:text-ink'
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
              ? 'border-[#0A5CFF] text-[#0A5CFF] dark:text-[var(--transit-accent)]'
              : 'border-transparent text-slate-500 dark:text-ink-3 hover:text-slate-800 dark:hover:text-ink'
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
              ? 'border-[#0A5CFF] text-[#0A5CFF] dark:text-[var(--transit-accent)]'
              : 'border-transparent text-slate-500 dark:text-ink-3 hover:text-slate-800 dark:hover:text-ink'
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
              ? 'border-[#0A5CFF] text-[#0A5CFF] dark:text-[var(--transit-accent)]'
              : 'border-transparent text-slate-500 dark:text-ink-3 hover:text-slate-800 dark:hover:text-ink'
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
              ? 'border-[#0A5CFF] text-[#0A5CFF] dark:text-[var(--transit-accent)]'
              : 'border-transparent text-slate-500 dark:text-ink-3 hover:text-slate-800 dark:hover:text-ink'
          }`}
        >
          <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          R1 Release Progress
        </button>
      </div>

      {/* Tab 1: Verification Queue */}
      {activeTab === 'verification' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-ink-2">
            <span>
              Pending &amp; Needs Info queue ({queueListings.length}) · Approved live ({verifiedListings.length}) · Drafts ({draftListings.length})
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline text-slate-500 dark:text-ink-3 text-xs">
              Loading verification queue...
            </div>
          ) : queueListings.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline text-slate-500 dark:text-ink-3 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All submitted listings have been reviewed.
            </div>
          ) : (
            <div className="space-y-4">
              {queueListings.map((listing, index) => (
                <div
                  key={listing.id}
                  style={staggerStyle(index)}
                  className="bg-white dark:bg-surface rounded-2xl p-6 border border-slate-200 dark:border-hairline shadow-sm space-y-4 text-xs animate-fade-up"
                >
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            listing.status === 'NEEDS_INFO'
                              ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300'
                              : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {listing.status === 'NEEDS_INFO' ? 'Needs Info' : 'Submitted · Pending Review'}
                        </span>
                        <span className="text-slate-500 dark:text-ink-3 font-semibold">
                          {listing.providerType} · {listing.category}
                        </span>
                        <span className="font-mono text-slate-400 dark:text-ink-3">
                          Pin: {listing.latitude.toFixed(4)}, {listing.longitude.toFixed(4)}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-ink">{listing.title}</h3>
                      <p className="text-slate-600 dark:text-ink-2">{listing.address}</p>
                      <p className="text-slate-500 dark:text-ink-3 text-[11px]">
                        Host: <strong>{listing.providerName}</strong> · Capacity: {listing.totalCapacity} bays · ₹{listing.pricing.hourlyRate}/hr · Photos: {listing.photos.length}
                      </p>
                      {listing.reviewReason && (
                        <p className="text-orange-700 dark:text-orange-300 font-semibold text-[11px]">
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
                        className="w-full bg-slate-50 dark:bg-surface-alt border border-slate-300 dark:border-hairline-strong rounded-xl px-3 py-2 text-xs"
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
                          className="flex-1 px-3 py-2 rounded-xl bg-orange-100 dark:bg-orange-500/15 hover:bg-orange-200 dark:hover:bg-orange-500/25 text-orange-900 dark:text-orange-300 font-bold flex items-center justify-center gap-1"
                        >
                          <MessageSquareWarning className="w-3.5 h-3.5" />
                          Needs Info
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateListing(listing.id, 'REJECTED')}
                          className="px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/15 hover:bg-red-200 dark:hover:bg-red-500/25 text-red-800 dark:text-red-300 font-bold flex items-center justify-center gap-1"
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
                          className="w-28 h-20 rounded-xl object-cover border border-slate-200 dark:border-hairline flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}

                  {/* Restricted Right-to-Rent Documents (PRD 7.3 — every view is audit-logged) */}
                  <div className="p-4 bg-slate-50 dark:bg-surface-alt rounded-xl border border-slate-200 dark:border-hairline space-y-2">
                    <span className="font-bold text-slate-800 dark:text-ink block">
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
                            className="p-3 bg-white dark:bg-surface hover:bg-blue-50/40 dark:hover:bg-blue-500/15 rounded-xl border border-slate-200 dark:border-hairline flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-[#0A5CFF] dark:text-[var(--transit-accent)] flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-ink block">{doc.docType.replace(/_/g, ' ')}</span>
                                <span className="text-[10px] text-slate-500 dark:text-ink-3 font-mono truncate block">
                                  {doc.fileName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#0A5CFF] dark:text-[var(--transit-accent)] flex items-center gap-1 flex-shrink-0 ml-2">
                              Inspect <ExternalLink className="w-3 h-3" />
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 dark:text-ink-3 italic">No verification proof files attached.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live Approved Listings */}
          <div>
            <h3 className="font-black text-slate-900 dark:text-ink text-sm mb-3">Live Approved Listings ({verifiedListings.length})</h3>
            <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline overflow-hidden divide-y divide-slate-100 dark:divide-hairline text-xs">
              {verifiedListings.map((l) => (
                <div key={l.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-ink">{l.title}</span>
                    <span className="text-slate-500 dark:text-ink-3 block text-[11px]">
                      {l.category} · ₹{l.pricing.hourlyRate}/hr · {l.locality} · Confirmed{' '}
                      {new Date(l.lastConfirmedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {l.isStale && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                        Stale (&gt;30d)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateListing(l.id, 'SUSPENDED')}
                      className="px-3 py-1 rounded-lg text-slate-600 dark:text-ink-2 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 font-semibold border border-slate-200 dark:border-hairline"
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
              <h3 className="font-black text-slate-900 dark:text-ink text-sm mb-3">
                Rejected &amp; Suspended Listings ({inactiveListings.length})
              </h3>
              <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline overflow-hidden divide-y divide-slate-100 dark:divide-hairline text-xs">
                {inactiveListings.map((l) => (
                  <div key={l.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-ink">{l.title}</span>
                      <span className="text-slate-500 dark:text-ink-3 block text-[11px]">
                        Status: <strong>{l.status}</strong> {l.reviewReason ? `· Reason: ${l.reviewReason}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateListing(l.id, 'VERIFIED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1"
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
          <div className="text-xs text-slate-500 dark:text-ink-3">
            Complaints queue with {APP_CONFIG.disputeSlaHours}-hour target first response SLA.
          </div>

          {disputes.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline text-slate-500 dark:text-ink-3 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Zero disputes logged.
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute, index) => (
                <div
                  key={dispute.id}
                  style={staggerStyle(index)}
                  className="bg-white dark:bg-surface rounded-2xl p-6 border border-slate-200 dark:border-hairline shadow-sm space-y-4 text-xs animate-fade-up"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300">
                          {dispute.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-slate-400 dark:text-ink-3">Ref: {dispute.bookingReference}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-ink mt-2">{dispute.description}</p>
                      <p className="text-[11px] text-slate-500 dark:text-ink-3 mt-1">
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
                          className="w-full bg-slate-50 dark:bg-surface-alt border border-slate-300 dark:border-hairline-strong rounded-xl px-3 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Refund Amount (₹)"
                          onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-surface-alt border border-slate-300 dark:border-hairline-strong rounded-xl px-3 py-1.5 text-xs tabular-nums"
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
            <div className="p-8 text-center bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline text-slate-500 dark:text-ink-3">
              No payment ledger entries loaded yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm">
                  <span className="text-slate-500 dark:text-ink-3 block font-medium">Total Processed</span>
                  <span className="text-xl font-black text-slate-900 dark:text-ink">₹{reconciliation.totalProcessedVolume}</span>
                </div>
                <div className="p-4 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm">
                  <span className="text-slate-500 dark:text-ink-3 block font-medium">VPark Fee + Tax</span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">₹{reconciliation.totalPlatformRevenue}</span>
                </div>
                <div className="p-4 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm">
                  <span className="text-slate-500 dark:text-ink-3 block font-medium">Host Payouts Owed</span>
                  <span className="text-xl font-black text-[#0A5CFF] dark:text-[var(--transit-accent)]">₹{reconciliation.totalProviderOwed}</span>
                </div>
                <div className="p-4 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm">
                  <span className="text-slate-500 dark:text-ink-3 block font-medium">Reconciliation</span>
                  <span className="text-xl font-black text-slate-900 dark:text-ink">{reconciliation.reconciliationRate}%</span>
                </div>
              </div>

              <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 dark:bg-surface-alt border-b border-slate-200 dark:border-hairline font-bold text-slate-800 dark:text-ink">
                  Gateway Transactions Audit Log
                </div>
                <div className="divide-y divide-slate-100 dark:divide-hairline overflow-x-auto">
                  {reconciliation.payments.map((pay: Payment) => (
                    <div key={pay.id} className="p-4 flex items-center justify-between gap-4 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-ink block font-mono">{pay.referenceNumber}</span>
                        <span className="text-slate-500 dark:text-ink-3">
                          <span className="font-mono">{pay.gatewayTransactionId}</span> · {pay.method}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-ink block tabular-nums">₹{pay.amount.toFixed(2)}</span>
                        <span className="text-emerald-700 dark:text-emerald-300">
                          Host: ₹{pay.providerEarning.toFixed(2)} · Fee+Tax: ₹{pay.platformCommission.toFixed(2)}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
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
        <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline overflow-hidden shadow-sm text-xs animate-fade-in">
          <div className="p-4 bg-slate-50 dark:bg-surface-alt border-b border-slate-200 dark:border-hairline font-bold text-slate-800 dark:text-ink">
            Security, Consent, Verification &amp; Admin Audit Log
          </div>
          <div className="divide-y divide-slate-100 dark:divide-hairline">
            {auditLogs.map((log, index) => (
              <div
                key={log.id}
                style={staggerStyle(index, 30)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in transition-colors hover:bg-slate-50 dark:hover:bg-surface-alt"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-ink font-mono">{log.action}</span>
                    <span className="text-[10px] text-slate-400 dark:text-ink-3 font-mono">Target: {log.targetId}</span>
                  </div>
                  <p className="text-slate-600 dark:text-ink-2 mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400 dark:text-ink-3 flex-shrink-0">
                  <span className="block font-medium text-slate-600 dark:text-ink-2">{log.actorName}</span>
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
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-ink flex items-center justify-between">
            <div>
              <span className="font-black text-sm block">Yelahanka Foundation Release Gates (Live Database Metrics)</span>
              <span className="text-xs text-slate-600 dark:text-ink-2">
                Measured directly from live database tables — never placeholder or estimated metrics.
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#0A5CFF] text-white font-bold text-xs">
              R1 Live Tracker
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500 dark:text-ink-3">R1 Verified Supply Target</span>
              <div className="text-2xl font-black text-slate-900 dark:text-ink">
                {verifiedListings.length} / {APP_CONFIG.r1VerifiedListingTarget}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-ink-2">
                Approved listings in DB ({queueListings.length} currently queued for review).
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500 dark:text-ink-3">Open Disputes / SLA</span>
              <div className="text-2xl font-black text-slate-900 dark:text-ink">
                {disputes.filter((d) => d.status === 'OPEN').length} open
              </div>
              <p className="text-[11px] text-slate-600 dark:text-ink-2">
                {disputes.length} total tickets logged under {APP_CONFIG.disputeSlaHours}h response target.
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-hairline shadow-sm space-y-1.5">
              <span className="font-bold text-slate-500 dark:text-ink-3">Security &amp; Verification Events</span>
              <div className="text-2xl font-black text-slate-900 dark:text-ink">{auditLogs.length}</div>
              <p className="text-[11px] text-slate-600 dark:text-ink-2">
                Immutable audit entries recorded across OTP logins, consents, and document views.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
