import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getEodStatus,
  getEodSummary,
  closeDay,
  getEodClosings,
} from "../../application/eodService";

interface Summary {
  date: string;
  stationId: number;
  salesCount: number;
  salesTotal: number;
  expenseTotal: number;
  closed: boolean;
  closing: {
    id: number;
    businessDate: string;
    stationId: number;
    expectedCash: number;
    countedCash: number;
    difference: number;
    expenseTotal: number;
    closedBy: number;
    closedAt: string;
  } | null;
}

const Eod: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessEodReport } = useAuth();

  const [date, setDate] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<Summary["closing"][]>([]);

  useEffect(() => {
    const init = async () => {
      const status = await getEodStatus();
      if (status?.today) setDate(status.today);
    };
    init();
  }, []);

  const loadSummary = useCallback(async () => {
    if (!date) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await getEodSummary(date);
      if (result) {
        setSummary(result);
        if (result.closed) {
          setCountedCash(String(result.closing?.countedCash ?? ""));
        }
      }
    } catch {
      setError(t("failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    if (date) loadSummary();
  }, [date, loadSummary]);

  const loadHistory = useCallback(async () => {
    try {
      const closings = await getEodClosings();
      setHistory(closings);
    } catch {
      // History is best-effort; ignore failures
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClose = async () => {
    setError("");
    setSuccess("");
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(t("invalidCountedCash"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await closeDay(date, amount);
      if (result.success) {
        setSuccess(t("dayClosed"));
        setConfirming(false);
        await loadSummary();
        await loadHistory();
      } else {
        setError(result.error || t("closeFailed"));
      }
    } catch {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!canAccessEodReport()) {
    return (
      <div className="screen eod">
        <h1>{t("eodReport")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen eod">
      <div className="screen-header">
        <h1>{t("eodReport")}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="commission-section">
        <div className="commission-controls">
          <div className="form-group">
            <label>{t("businessDate")}</label>
            <input type="date" value={date} max={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={loadSummary}
            disabled={isLoading}
          >
            {t("calculate")}
          </button>
        </div>

        {isLoading ? (
          <p>{t("loading")}</p>
        ) : summary ? (
          <div className="eod-summary">
            <div className="eod-stat">
              <span className="eod-stat-label">{t("totalSales")}</span>
              <span className="eod-stat-value">{summary.salesTotal.toLocaleString()} IQD</span>
              <span className="eod-stat-sub">
                {summary.salesCount} {t("salesCountSuffix")}
              </span>
            </div>
            <div className="eod-stat">
              <span className="eod-stat-label">{t("expenseTotal")}</span>
              <span className="eod-stat-value">{summary.expenseTotal.toLocaleString()} IQD</span>
            </div>
            <div className="eod-stat">
              <span className="eod-stat-label">{t("status")}</span>
              <span className={`eod-stat-value ${summary.closed ? "text-muted" : ""}`}>
                {summary.closed ? t("statusClosed") : t("statusOpen")}
              </span>
            </div>

            {!summary.closed ? (
              <div className="eod-close-form">
                <div className="form-group">
                  <label>{t("countedCash")}</label>
                  <input
                    type="number"
                    min={0}
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                  />
                </div>
                {confirming ? (
                  <div className="rate-edit">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={handleClose}
                      disabled={isLoading}
                    >
                      {t("confirm")}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setConfirming(false)}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      setConfirming(true);
                    }}
                  >
                    {t("closeDayBtn")}
                  </button>
                )}
              </div>
            ) : (
              history.length > 0 && (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("businessDate")}</th>
                        <th>{t("expectedCash")}</th>
                        <th>{t("countedCash")}</th>
                        <th>{t("difference")}</th>
                        <th>{t("expenseTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((c) => (
                        <tr key={c?.id}>
                          <td>{c?.businessDate}</td>
                          <td>{(c?.expectedCash ?? 0).toLocaleString()} IQD</td>
                          <td>{(c?.countedCash ?? 0).toLocaleString()} IQD</td>
                          <td>{(c?.difference ?? 0).toLocaleString()} IQD</td>
                          <td>{(c?.expenseTotal ?? 0).toLocaleString()} IQD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-muted">{t("selectDate")}</p>
        )}
      </section>
    </div>
  );
};

export default Eod;
