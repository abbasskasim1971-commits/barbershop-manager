import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getReport,
  getReportPresetRange,
  printReport,
  exportReport,
} from "../../application/reportService";
import { AuthService } from "../../application/authService";

type ActiveReport = "profitLoss" | "sales" | "barberDues" | "barberComparison";
type Preset = "daily" | "weekly" | "monthly";

const money = (n: number): string => `${n.toLocaleString("en-US")} IQD`;

interface SortableCol<T> {
  key: string;
  header: string;
  align: "text" | "num";
  value: (row: T) => string | number;
}

function useSorted<T>(
  rows: T[],
  cols: SortableCol<T>[],
  initialKey: string,
): [T[], string, "asc" | "desc", (key: string) => void] {
  const [sortKey, setSortKey] = useState(initialKey);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey) || cols[0];
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === "number" && typeof bv === "number") {
        return dir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), "ar");
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, cols, sortKey, dir]);

  const toggle = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setDir("desc");
      return key;
    });
  }, []);

  return [sorted, sortKey, dir, toggle];
}

function SortableTable<T>({
  cols,
  rows,
  keyAccessor,
  initialKey,
}: {
  cols: SortableCol<T>[];
  rows: T[];
  keyAccessor: (row: T) => string;
  initialKey: string;
}) {
  const { t } = useTranslation();
  const [sorted, sortKey, dir, toggle] = useSorted(rows, cols, initialKey);

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col.key} className={col.align === "num" ? "th-num" : ""}>
                <button type="button" className="sort-btn" onClick={() => toggle(col.key)}>
                  {col.header}
                  {sortKey === col.key ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="text-muted">
                {t("noData")}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={keyAccessor(row)}>
                {cols.map((col) => (
                  <td key={col.key} className={col.align === "num" ? "td-num" : ""}>
                    {String(col.value(row))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessReports } = useAuth();

  const [activeReport, setActiveReport] = useState<ActiveReport>("profitLoss");
  const [preset, setPreset] = useState<Preset>("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [barberId, setBarberId] = useState<number | undefined>();
  const [barbers, setBarbers] = useState<{ id: number; username: string }[]>([]);

  const [data, setData] = useState<ReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRange = useCallback(async (presetName: Preset, date?: string) => {
    const range = await getReportPresetRange(presetName, date);
    if (range) {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadRange("daily");
      try {
        const sessionId = AuthService.getSessionId() || "";
        const result = await window.auth.getActiveBarbers(sessionId);
        setBarbers(result || []);
      } catch {
        setBarbers([]);
      }
    };
    void init();
  }, [loadRange]);

  const loadReport = useCallback(
    async (report: ActiveReport, range?: { start: string; end: string }) => {
      const start = range?.start ?? startDate;
      const end = range?.end ?? endDate;
      if (!start || !end) {
        setError(t("selectDate"));
        return;
      }
      setIsLoading(true);
      setError("");
      setNotice("");
      try {
        const result = await getReport(
          report,
          start,
          end,
          report === "sales" ? barberId : undefined,
        );
        setData(result);
      } catch {
        setError(t("failedToLoad"));
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate, barberId, t],
  );

  useEffect(() => {
    if (startDate && endDate && !data && !isLoading) {
      void loadReport(activeReport);
    }
  }, [activeReport, startDate, endDate, data, isLoading, loadReport]);

  const onPreset = async (presetName: Preset) => {
    setPreset(presetName);
    await loadRange(presetName);
    setData(null);
  };

  const onReportTab = (report: ActiveReport) => {
    setActiveReport(report);
    setData(null);
  };

  if (!canAccessReports()) {
    return (
      <div className="screen reports">
        <h1>{t("reports")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen reports">
      <div className="screen-header">
        <h1>{t("reports")}</h1>
        <div className="report-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              setNotice("");
              const result = await printReport(
                activeReport,
                startDate,
                endDate,
                activeReport === "sales" ? barberId : undefined,
              );
              if (result?.success) setNotice(t("printedOk"));
              else setError(result?.error || t("printFailed"));
            }}
            disabled={!data || isLoading}
          >
            {t("print")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              setNotice("");
              const result = await exportReport(
                activeReport,
                startDate,
                endDate,
                activeReport === "sales" ? barberId : undefined,
              );
              if (result?.success) setNotice(t("exportedOk"));
              else setError(result?.error || t("exportFailed"));
            }}
            disabled={!data || isLoading}
          >
            {t("exportExcel")}
          </button>
        </div>
      </div>

      <section className="report-tabs">
        <button
          type="button"
          className={`btn ${activeReport === "profitLoss" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onReportTab("profitLoss")}
        >
          {t("profitLoss")}
        </button>
        <button
          type="button"
          className={`btn ${activeReport === "sales" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onReportTab("sales")}
        >
          {t("salesReport")}
        </button>
        <button
          type="button"
          className={`btn ${activeReport === "barberDues" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onReportTab("barberDues")}
        >
          {t("barberDues")}
        </button>
        <button
          type="button"
          className={`btn ${activeReport === "barberComparison" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onReportTab("barberComparison")}
        >
          {t("barberComparison")}
        </button>
      </section>

      <section className="report-controls">
        <div className="report-presets">
          <button
            type="button"
            className={`btn btn-sm ${preset === "daily" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => void onPreset("daily")}
          >
            {t("daily")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${preset === "weekly" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => void onPreset("weekly")}
          >
            {t("weekly")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${preset === "monthly" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => void onPreset("monthly")}
          >
            {t("monthly")}
          </button>
        </div>
        <div className="form-group report-dates">
          <label>{t("startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setPreset("customRange" as Preset);
              setStartDate(e.target.value);
              setData(null);
            }}
          />
          <label>{t("endDate")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setPreset("customRange" as Preset);
              setEndDate(e.target.value);
              setData(null);
            }}
          />
        </div>
        {activeReport === "sales" && (
          <div className="form-group">
            <label>{t("barber")}</label>
            <select
              value={barberId ?? ""}
              onChange={(e) => {
                setBarberId(e.target.value ? Number(e.target.value) : undefined);
                setData(null);
              }}
            >
              <option value="">{t("allBarbers")}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void loadReport(activeReport)}
          disabled={isLoading}
        >
          {t("calculate")}
        </button>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="report-content">
        {isLoading ? (
          <p>{t("loading")}</p>
        ) : data ? (
          <ReportBody data={data} />
        ) : (
          <p className="text-muted">{t("selectReport")}</p>
        )}
      </section>
    </div>
  );
};

const ReportBody: React.FC<{ data: ReportPayload }> = ({ data }) => {
  const { t } = useTranslation();

  if (data.reportName === "profitLoss") {
    const lines = [
      { label: t("serviceRevenue"), value: money(data.serviceRevenue) },
      { label: t("productRevenue"), value: money(data.productRevenue) },
      { label: t("totalRevenue"), value: money(data.salesRevenue), strong: true },
      { label: t("cogsLabel"), value: money(data.cogs) },
      { label: t("grossProfit"), value: money(data.grossProfit), strong: true },
      { label: t("barberCommissions"), value: money(data.barberCommissions) },
      { label: t("operatingExpenses"), value: money(data.operatingExpenses) },
      { label: t("netShopProfit"), value: money(data.netShopProfit), strong: true },
      {
        label: t("ownerWithdrawals"),
        value: money(data.ownerWithdrawals),
        strong: false,
      },
    ];
    return (
      <div className="pl-report">
        <div className="pl-stats">
          <span className="pl-stat">
            {t("salesCountLabel")}: {data.salesCount}
          </span>
          <span className="pl-stat">
            {t("jobs")}: {data.serviceJobsCount}
          </span>
          <span className="pl-stat">
            {t("period")}: {data.startDate} → {data.endDate}
          </span>
        </div>
        <table className="data-table pl-table">
          <tbody>
            {lines.map((line) => (
              <tr key={line.label} className={line.strong ? "row-strong" : ""}>
                <td className={line.strong ? "text-muted" : ""}>{line.label}</td>
                <td className="td-num">{line.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.reportName === "sales") {
    const serviceCols: SortableCol<ServiceBreakdownRow>[] = [
      { key: "name", header: t("service"), align: "text", value: (r) => r.name },
      { key: "quantity", header: t("quantity"), align: "num", value: (r) => r.quantity },
      { key: "revenue", header: t("total"), align: "num", value: (r) => money(r.revenue) },
    ];
    const productCols: SortableCol<ProductBreakdownRow>[] = [
      { key: "name", header: t("product"), align: "text", value: (r) => r.name },
      { key: "quantity", header: t("quantity"), align: "num", value: (r) => r.quantity },
      { key: "revenue", header: t("total"), align: "num", value: (r) => money(r.revenue) },
      { key: "cost", header: t("cogsLabel"), align: "num", value: (r) => money(r.cost) },
      {
        key: "grossProfit",
        header: t("grossProfit"),
        align: "num",
        value: (r) => money(r.grossProfit),
      },
    ];
    return (
      <div className="sales-report">
        <div className="pl-stats">
          <span className="pl-stat">
            {t("salesCountLabel")}: {data.salesCount}
          </span>
          <span className="pl-stat">
            {t("serviceRevenue")}: {money(data.serviceRevenue)}
          </span>
          <span className="pl-stat">
            {t("productRevenue")}: {money(data.productRevenue)}
          </span>
          <span className="pl-stat">
            {t("totalRevenue")}: {money(data.totalRevenue)}
          </span>
          {data.barberName && (
            <span className="pl-stat">
              {t("barber")}: {data.barberName}
            </span>
          )}
        </div>
        <SortableTable
          cols={serviceCols}
          rows={data.byService}
          keyAccessor={(r) => `s-${r.name}`}
          initialKey="revenue"
        />
        <SortableTable
          cols={productCols}
          rows={data.byProduct}
          keyAccessor={(r) => `p-${r.productId}-${r.name}`}
          initialKey="revenue"
        />
      </div>
    );
  }

  if (data.reportName === "barberDues") {
    const cols: SortableCol<BarberRow>[] = [
      { key: "username", header: t("barber"), align: "text", value: (r) => r.username },
      { key: "salesCount", header: t("salesCountLabel"), align: "num", value: (r) => r.salesCount },
      { key: "jobs", header: t("jobs"), align: "num", value: (r) => r.jobs },
      {
        key: "serviceRevenue",
        header: t("serviceRevenue"),
        align: "num",
        value: (r) => money(r.serviceRevenue),
      },
      { key: "commission", header: t("dues"), align: "num", value: (r) => money(r.commission) },
    ];
    return (
      <div className="dues-report">
        <p>
          {t("period")}: {data.startDate} → {data.endDate} | {t("totalDues")}:{" "}
          {money(data.totals.commission)}
        </p>
        <SortableTable
          cols={cols}
          rows={data.rows}
          keyAccessor={(r) => `b-${r.barberId}`}
          initialKey="serviceRevenue"
        />
      </div>
    );
  }

  const cols: SortableCol<BarberComparisonRow>[] = [
    { key: "rank", header: t("rank"), align: "num", value: (r) => r.rank },
    { key: "username", header: t("barber"), align: "text", value: (r) => r.username },
    { key: "salesCount", header: t("salesCountLabel"), align: "num", value: (r) => r.salesCount },
    { key: "jobs", header: t("jobs"), align: "num", value: (r) => r.jobs },
    {
      key: "serviceRevenue",
      header: t("serviceRevenue"),
      align: "num",
      value: (r) => money(r.serviceRevenue),
    },
    { key: "commission", header: t("dues"), align: "num", value: (r) => money(r.commission) },
  ];
  return (
    <div className="comparison-report">
      <p>
        {t("period")}: {data.startDate} → {data.endDate}
      </p>
      <SortableTable
        cols={cols}
        rows={data.rows}
        keyAccessor={(r) => `c-${r.barberId}`}
        initialKey="serviceRevenue"
      />
    </div>
  );
};

export default Reports;
