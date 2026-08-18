import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LeaveApprovalModal } from '../../components/common/LeaveApprovalModal.jsx';


// ---------------------------------------------------------------------------
// Jira
// ---------------------------------------------------------------------------

const JIRA_LIST_URL =
  'https://meiyappansworkspace-43655612.atlassian.net/jira/software/projects/KAN/list?jql=project%20%3D%20KAN%20ORDER%20BY%20cf%5B10019%5D%20ASC';


// ---------------------------------------------------------------------------
// Jira panel
// ---------------------------------------------------------------------------

function JiraPanel() {
  return (
    <div
      className="mt-3 pt-3 border-t border-[#dfe5e8]/70"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">

        {/* Jira information */}

        <div className="flex items-center gap-2">

          <div className="w-7 h-7 rounded-md bg-[#0052cc] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 fill-white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M11.53 2.13a.75.75 0 0 0-1.06 0L2.13 10.47a.75.75 0 0 0 0 1.06l8.34 8.34a.75.75 0 0 0 1.06 0l8.34-8.34a.75.75 0 0 0 0-1.06zm-.53 14.6L3.69 11 11 3.69 18.31 11z" />
            </svg>
          </div>

          <div>
            <span className="text-xs font-bold text-[#0f1d27] block">
              Jira Workload
            </span>

            <span className="text-[10px] text-[#687781]">
              Open the employee task list in Jira
            </span>
          </div>

        </div>


        {/* Direct redirect */}

        <a
          href={JIRA_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2 text-[11px] font-semibold text-white bg-[#0052cc] hover:bg-[#0747a6] px-3 py-2 rounded-lg transition-colors"
        >

          <span className="material-symbols-outlined text-[15px]">
            open_in_new
          </span>

          Open Jira

        </a>

      </div>


      {/* Jira URL */}

      <div className="mt-3 p-3 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8]">

        <span className="text-[10px] uppercase font-bold text-[#687781] block mb-1.5">
          Jira Board / List
        </span>

        <a
          href={JIRA_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-[#0052cc] hover:underline break-all font-mono"
        >
          {JIRA_LIST_URL}
        </a>

      </div>

    </div>
  );
}


// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function PendingApprovalsPage() {

  const {
    currentUser,
  } = useAuth();


  const {
    getPendingApprovals,
    approveLeaveRequest,
    getUserBalances,
  } = useLeave();


  const [
    selectedRequest,
    setSelectedRequest,
  ] = useState(null);


  const [
    modalMode,
    setModalMode,
  ] = useState('review');


  const [
    selectedIds,
    setSelectedIds,
  ] = useState([]);


  const [
    bulkProcessing,
    setBulkProcessing,
  ] = useState(false);


  const [
    expandedId,
    setExpandedId,
  ] = useState(null);


  // -------------------------------------------------------------------------
  // Pending requests
  // -------------------------------------------------------------------------

  const pendingRequests =
    getPendingApprovals(
      currentUser?.id
    );


  // -------------------------------------------------------------------------
  // Select all
  // -------------------------------------------------------------------------

  const handleSelectAll = () => {

    if (
      selectedIds.length ===
      pendingRequests.length
    ) {

      setSelectedIds([]);

    } else {

      setSelectedIds(
        pendingRequests.map(
          (r) => r.id
        )
      );

    }

  };


  // -------------------------------------------------------------------------
  // Toggle selection
  // -------------------------------------------------------------------------

  const handleToggleSelect = (
    id
  ) => {

    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
            (item) =>
              item !== id
          )
          : [
            ...prev,
            id,
          ]
    );

  };


  // -------------------------------------------------------------------------
  // Bulk approve
  // -------------------------------------------------------------------------

  const handleBulkApprove = () => {

    if (
      selectedIds.length ===
      0
    ) {

      return;

    }


    setBulkProcessing(
      true
    );


    selectedIds.forEach(
      (id) => {

        approveLeaveRequest(
          id,
          'Batch approved by manager'
        );

      }
    );


    setSelectedIds([]);

    setBulkProcessing(
      false
    );

  };


  // -------------------------------------------------------------------------
  // Open review modal
  // -------------------------------------------------------------------------

  const handleOpenReview = (
    req,
    mode = 'review'
  ) => {

    setSelectedRequest(
      req
    );

    setModalMode(
      mode
    );

  };


  // -------------------------------------------------------------------------
  // Quick approve
  // -------------------------------------------------------------------------

  const handleQuickApprove = (
    e,
    req
  ) => {

    e.stopPropagation();

    approveLeaveRequest(
      req.id,
      'Approved by manager'
    );

  };


  // -------------------------------------------------------------------------
  // Toggle Jira panel
  // -------------------------------------------------------------------------

  const handleToggleExpand = (
    e,
    id
  ) => {

    e.stopPropagation();

    setExpandedId(
      (prev) =>
        prev === id
          ? null
          : id
    );

  };


  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (

    <div className="space-y-6">

      {/* =====================================================================
          Header
      ====================================================================== */}

      <PageHeader
        title="Pending Approvals"
        subtitle="Review and take action on leave requests from members in your direct team."
      >

        {selectedIds.length >
          0 && (

            <div className="flex items-center gap-3 animate-in fade-in duration-150">

              <span className="text-xs text-[#687781] font-semibold">

                {selectedIds.length}
                {' '}
                request
                {selectedIds.length >
                  1
                  ? 's'
                  : ''}
                {' '}
                selected

              </span>


              <Button
                variant="primary"
                size="sm"
                icon="check_circle"
                loading={
                  bulkProcessing
                }
                onClick={
                  handleBulkApprove
                }
                className="bg-[#22874e] hover:bg-[#1a6e3e]"
              >

                Approve Selected (
                {selectedIds.length}
                )

              </Button>

            </div>

          )}

      </PageHeader>


      {/* =====================================================================
          Queue Info
      ====================================================================== */}

      <div className="bg-white p-4 rounded-2xl border border-[#dfe5e8] shadow-xs flex items-center justify-between flex-wrap gap-4">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-[#fff8e1] text-[#b7791f] flex items-center justify-center">

            <span className="material-symbols-outlined text-[22px]">
              pending_actions
            </span>

          </div>


          <div>

            <h3 className="text-sm font-bold text-[#0f1d27]">

              Approval Queue (
              {pendingRequests.length}
              {' '}
              Pending)

            </h3>


            <p className="text-xs text-[#687781]">

              Approve or reject requests with full audit trail for payroll and project planning.

            </p>

          </div>

        </div>


        {pendingRequests.length >
          0 && (

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={
                  handleSelectAll
                }
                className="text-xs font-semibold text-[#00646f] hover:underline cursor-pointer px-2 py-1"
              >

                {selectedIds.length ===
                  pendingRequests.length
                  ? 'Deselect All'
                  : 'Select All'}

              </button>

            </div>

          )}

      </div>


      {/* =====================================================================
          Pending requests
      ====================================================================== */}

      {pendingRequests.length ===
        0 ? (

        <Card className="p-12 text-center border-[#dfe5e8]">

          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">

            <div className="w-16 h-16 rounded-2xl bg-[#d8f3e5] text-[#22874e] flex items-center justify-center shadow-xs">

              <span className="material-symbols-outlined text-[36px]">
                task_alt
              </span>

            </div>


            <h3 className="text-lg font-bold text-[#0f1d27]">

              All Caught Up!

            </h3>


            <p className="text-xs sm:text-sm text-[#687781] leading-relaxed">

              There are no pending leave requests for your team at this time. New submissions from your team will appear here automatically.

            </p>

          </div>

        </Card>

      ) : (

        <div className="space-y-4">

          {pendingRequests.map(
            (req) => {

              const balances =
                getUserBalances(
                  req.userId
                );


              const isSelected =
                selectedIds.includes(
                  req.id
                );


              const isExpanded =
                expandedId ===
                req.id;


              return (

                <div
                  key={
                    req.id
                  }
                  className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all shadow-xs hover:shadow-md ${isSelected
                      ? 'border-[#00646f] ring-2 ring-[#00646f]/10 bg-[#f8fbfb]'
                      : 'border-[#dfe5e8] hover:border-[#00646f]/40'
                    }`}
                >

                  {/* =========================================================
                      Main row
                  ========================================================== */}

                  <div
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 cursor-pointer"
                    onClick={() =>
                      handleOpenReview(
                        req,
                        'review'
                      )
                    }
                  >

                    {/* =======================================================
                        Employee information
                    ======================================================== */}

                    <div className="flex items-start gap-4 flex-1">

                      <div
                        className="pt-1"
                        onClick={(e) => {

                          e.stopPropagation();

                          handleToggleSelect(
                            req.id
                          );

                        }}
                      >

                        <input
                          type="checkbox"
                          checked={
                            isSelected
                          }
                          onChange={() => { }}
                          className="w-4 h-4 rounded text-[#00646f] focus:ring-[#00646f] border-[#dfe5e8] cursor-pointer"
                        />

                      </div>


                      <div className="flex items-center gap-3.5">

                        {req.avatar ? (

                          <img
                            src={
                              req.avatar
                            }
                            alt={
                              req.employeeName
                            }
                            className="w-12 h-12 rounded-full object-cover border border-[#dfe5e8]"
                          />

                        ) : (

                          <div className="w-12 h-12 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">

                            {
                              req.initials ||
                              req.employeeName
                                ?.slice(
                                  0,
                                  2
                                )
                                .toUpperCase()
                            }

                          </div>

                        )}


                        <div>

                          <div className="flex items-center gap-2">

                            <h4 className="text-sm font-bold text-[#0f1d27] hover:text-[#00646f]">

                              {
                                req.employeeName
                              }

                            </h4>


                            <span className="text-xs font-mono text-[#687781]">

                              (
                              {req.id}
                              )

                            </span>

                          </div>


                          <p className="text-xs text-[#687781]">

                            {
                              req.position ||
                              'Team Member'
                            }

                          </p>


                          <div className="flex items-center gap-2 mt-1">

                            <span className="text-[11px] text-[#00646f] font-semibold bg-[#ebf5ff] px-2 py-0.5 rounded-md">

                              {
                                req.department
                              }

                            </span>


                            <span className="text-[11px] text-[#687781]">

                              Submitted
                              {' '}
                              {
                                req.submittedDisplay ||
                                req.submittedAt
                              }

                            </span>

                          </div>

                        </div>

                      </div>

                    </div>


                    {/* =======================================================
                        Leave information
                    ======================================================== */}

                    <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-r border-[#dfe5e8] lg:px-6 py-2 lg:py-0">

                      <div>

                        <span className="text-[10px] uppercase font-bold text-[#687781] block">

                          Leave Type

                        </span>


                        <div className="flex items-center gap-1.5 mt-0.5">

                          <span className="material-symbols-outlined text-[18px] text-[#00646f]">

                            {
                              req.typeKey ===
                                'sick'
                                ? 'medical_services'
                                : 'event'
                            }

                          </span>


                          <span className="text-xs sm:text-sm font-bold text-[#0f1d27]">

                            {
                              req.leaveType
                            }

                          </span>

                        </div>

                      </div>


                      <div>

                        <span className="text-[10px] uppercase font-bold text-[#687781] block">

                          Period & Duration

                        </span>


                        <div className="mt-0.5">

                          <span className="text-xs sm:text-sm font-bold text-[#0f1d27] block">

                            {
                              req.dateDisplay
                            }

                          </span>


                          <span className="text-xs text-[#00646f] font-semibold">

                            {
                              req.durationDays
                            }
                            {' '}
                            Working Day
                            {
                              req.durationDays >
                                1
                                ? 's'
                                : ''
                            }

                          </span>

                        </div>

                      </div>


                      <div>

                        <span className="text-[10px] uppercase font-bold text-[#687781] block">

                          Balance Remaining

                        </span>


                        <div className="mt-0.5 flex items-center gap-2">

                          <span className="text-xs font-bold text-[#22874e] bg-[#d8f3e5] px-2 py-0.5 rounded-md">

                            {
                              req.typeKey ===
                                'sick'
                                ? `${balances.sick.remaining}d Sick left`
                                : `${balances.annual.remaining}d Annual left`
                            }

                          </span>

                        </div>

                      </div>

                    </div>


                    {/* =======================================================
                        Actions
                    ======================================================== */}

                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >

                      {/* Jira */}

                      <button
                        type="button"
                        title="Open Jira"
                        onClick={(e) =>
                          handleToggleExpand(
                            e,
                            req.id
                          )
                        }
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${isExpanded
                            ? 'bg-[#0052cc] text-white border-[#0052cc]'
                            : 'bg-white text-[#0052cc] border-[#0052cc]/30 hover:bg-[#ebf5ff]'
                          }`}
                      >

                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 fill-current"
                          xmlns="http://www.w3.org/2000/svg"
                        >

                          <path d="M11.53 2.13a.75.75 0 0 0-1.06 0L2.13 10.47a.75.75 0 0 0 0 1.06l8.34 8.34a.75.75 0 0 0 1.06 0l8.34-8.34a.75.75 0 0 0 0-1.06zm-.53 14.6L3.69 11 11 3.69 18.31 11z" />

                        </svg>

                        Jira

                      </button>


                      {/* Review */}

                      <Button
                        variant="ghost"
                        size="sm"
                        icon="visibility"
                        onClick={() =>
                          handleOpenReview(
                            req,
                            'review'
                          )
                        }
                      >

                        Review

                      </Button>


                      {/* Approve */}

                      <Button
                        variant="primary"
                        size="sm"
                        icon="check_circle"
                        onClick={(e) =>
                          handleQuickApprove(
                            e,
                            req
                          )
                        }
                        className="bg-[#22874e] hover:bg-[#1a6e3e]"
                      >

                        Approve

                      </Button>


                      {/* Reject */}

                      <Button
                        variant="danger"
                        size="sm"
                        icon="cancel"
                        onClick={() =>
                          handleOpenReview(
                            req,
                            'reject'
                          )
                        }
                      >

                        Reject

                      </Button>

                    </div>

                  </div>


                  {/* =========================================================
                      Reason
                  ========================================================== */}

                  {req.reason && (

                    <div className="mt-4 pt-3 border-t border-[#dfe5e8]/70 flex items-start gap-2 bg-[#f8fbfb] p-3 rounded-xl">

                      <span className="material-symbols-outlined text-[16px] text-[#687781] shrink-0 mt-0.5">

                        chat_bubble_outline

                      </span>


                      <p className="text-xs text-[#3e494a] italic leading-relaxed">

                        "{req.reason}"

                      </p>

                    </div>

                  )}


                  {/* =========================================================
                      Jira
                  ========================================================== */}

                  {isExpanded && (

                    <JiraPanel />

                  )}

                </div>

              );

            }
          )}

        </div>

      )}


      {/* =====================================================================
          Review Modal
      ====================================================================== */}

      <LeaveApprovalModal
        isOpen={
          Boolean(
            selectedRequest
          )
        }
        onClose={() =>
          setSelectedRequest(
            null
          )
        }
        request={
          selectedRequest
        }
        initialMode={
          modalMode
        }
      />

    </div>

  );

}

