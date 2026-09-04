import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getCommissionRate,
  getCommissionDues,
  setCommissionRate,
} from "../../application/commissionService";
import { getBarbers } from "../../application/saleService";

interface BarberRow {
  id: number;
  username: string;
  rate: number;
  effectiveFrom: string | null;
  dues: number;
}

function baghdadParts(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = parts.split("-").map(Number);
  return { y, m, day };
}

function toBaghdadDate(d: Date): string {
  const { y, m, day } = baghdadParts(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addBaghdadDays(d: Date, days: number): string {
  const { y, m, day } = baghdadParts(d);
  const utc = Date.UTC(y, m - 1, day) + days * 24 * 60 * 60 * 1000;
  const target = new Date(utc);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(
    target.getUTCDate(),
  ).padStart(2, "0")}`;
}

const CommissionManagement: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessCommissionManagement } = useAuth();

  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedBarber, setSelectedBarber] = useState<number>(0);

  const loadBarbers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const list = await getBarbers();
      const rows = await Promise.all(
        list.map(async (b) => {
          const rate = await getCommissionRate(b.id);
          return {
            id: b.id,
            username: b.username,
            rate: rate ? rate.rate : 0,
            effectiveFrom: rate ? rate.effectiveFrom : null,
            dues: 0,
          };
        }),
      );
      setBarbers(rows);
    } catch {
      setError(t("failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBarbers();
  }, [loadBarbers]);

  const getRange = useCallback((): { start: string; end: string } => {
    const today = new Date();
    if (period === "today") {
      const d = toBaghdadDate(today);
      return { start: d, end: d };
    }
    if (period === "week") {
      const end = toBaghdadDate(today);
      const start = addBaghdadDays(today, -6);
      return { start, end };
    }
    if (period === "month") {
      const { y, m } = baghdadParts(today);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = toBaghdadDate(today);
      return { start, end };
    }
    return { start: startDate, end: endDate };
  }, [period, startDate, endDate]);

  const runDues = useCallback(async () => {
    setError("");
    setSuccess("");
    const { start, end } = getRange();
    if (!start || !end) {
      setError(t("customRangeRequired"));
      return;
    }
    try {
      const targets =
        selectedBarber === 0 ? barbers : barbers.filter((b) => b.id === selectedBarber);
      const updated = await Promise.all(
        targets.map(async (b) => {
          const dues = await getCommissionDues(b.id, start, end);
          return { ...b, dues };
        }),
      );
      setBarbers((prev) => prev.map((b) => updated.find((u) => u.id === b.id) || b));
      setSuccess(t("duesCalculated"));
    } catch {
      setError(t("operationFailed"));
    }
  }, [barbers, selectedBarber, getRange, t]);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const handleSetRate = async (barberId: number, rateValue: number) => {
    setError("");
    setSuccess("");
    if (rateValue < 0 || Number.isNaN(rateValue)) {
      setError(t("invalidRate"));
      return;
    }
    const result = await setCommissionRate(barberId, rateValue);
    if (result.success) {
      setSuccess(t("rateUpdated"));
      loadBarbers();
    } else {
      setError(result.error || t("setRateFailed"));
    }
  };

  const totalDues = barbers.reduce((sum, b) => sum + b.dues, 0);

  if (!canAccessCommissionManagement()) {
    return (
      <div className="screen commission-management">
        <h1>{t("commissionManagement")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen commission-management">
      <div className="screen-header">
        <h1>{t("commissionManagement")}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="commission-section">
        <h2>{t("barberDues")}</h2>

        <div className="commission-controls">
          <div className="form-group">
            <label>{t("period")}</label>
            <div className="period-buttons">
              <button
                className={`btn btn-sm ${period === "today" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPeriod("today")}
              >
                {t("daily")}
              </button>
              <button
                className={`btn btn-sm ${period === "week" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPeriod("week")}
              >
                {t("weekly")}
              </button>
              <button
                className={`btn btn-sm ${period === "month" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPeriod("month")}
              >
                {t("monthly")}
              </button>
              <button
                className={`btn btn-sm ${period === "custom" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPeriod("custom")}
              >
                {t("customRange")}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>{t("barber")}</label>
            <select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(Number(e.target.value))}
            >
              <option value={0}>{t("allBarbers")}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username}
                </option>
              ))}
            </select>
          </div>

          {period === "custom" && (
            <div className="commission-range">
              <div className="form-group">
                <label>{t("startDate")}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t("endDate")}</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={runDues} disabled={isLoading}>
            {t("calculate")}
          </button>
        </div>

        {isLoading ? (
          <p>{t("loading")}</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("barber")}</th>
                  <th>{t("currentRate")}</th>
                  <th>{t("effectiveFrom")}</th>
                  <th>{t("dues")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {barbers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  barbers.map((b) => <RateRow key={b.id} row={b} onSetRate={handleSetRate} />)
                )}
              </tbody>
              {barbers.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t("totalDues")}</td>
                    <td>{totalDues.toLocaleString()} IQD</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const RateRow: React.FC<{
  row: BarberRow;
  onSetRate: (barberId: number, rate: number) => void;
}> = ({ row, onSetRate }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [rateValue, setRateValue] = useState(String(row.rate));

  return (
    <tr>
      <td>{row.username}</td>
      <td>{row.rate}%</td>
      <td>{row.effectiveFrom ? dateLabel(row.effectiveFrom) : "—"}</td>
      <td>{row.dues.toLocaleString()} IQD</td>
      <td>
        {editing ? (
          <div className="rate-edit">
            <input
              type="number"
              min={0}
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
            />
            <button
              className="btn btn-sm btn-success"
              onClick={() => {
                onSetRate(row.id, Number(rateValue));
                setEditing(false);
              }}
            >
              {t("save")}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>
            {t("setRate")}
          </button>
        )}
      </td>
    </tr>
  );
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export default CommissionManagement;
