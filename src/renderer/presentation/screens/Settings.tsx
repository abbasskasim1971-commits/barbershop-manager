import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { SyncService, type StationEntry } from "../../application/syncService";

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { user, getSessionId } = useAuth();
  const [label, setLabel] = useState("");
  const [stations, setStations] = useState<StationEntry[]>([]);
  const [newToken, setNewToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const refreshStations = async () => {
    const sessionId = getSessionId() || "";
    const result = await SyncService.listStations(sessionId);
    setStations(result.stations);
  };

  useEffect(() => {
    void refreshStations();
  }, []);

  const handleRegister = async () => {
    setError("");
    setMessage("");
    setIsLoading(true);
    const sessionId = getSessionId() || "";
    const result = await SyncService.registerStation(sessionId, label);
    setIsLoading(false);
    if (result.success && result.token) {
      setNewToken(result.token);
      setLabel("");
      await refreshStations();
    } else {
      setError(result.error || t("operationFailed"));
    }
  };

  const canManage = user?.role === "owner" || user?.role === "manager";

  return (
    <div className="screen settings">
      <h1>{t("settings")}</h1>

      {canManage && (
        <section className="settings-section">
          <h2>{t("stationRegistration")}</h2>
          <p className="settings-blurb">{t("stationRegistrationInfo")}</p>

          <div className="form-group">
            <label htmlFor="station-label">{t("stationLabel")}</label>
            <input
              id="station-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("stationLabelPlaceholder")}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? t("registering") : t("registerStation")}
          </button>

          {error && <div className="alert alert-error">{error}</div>}

          {newToken && (
            <div className="station-token-box">
              <p>{t("stationTokenInfo")}</p>
              <code className="station-token">{newToken}</code>
              <p>{t("stationHostInfo")}</p>
            </div>
          )}

          {stations.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("id")}</th>
                  <th>{t("stationLabel")}</th>
                  <th>{t("role")}</th>
                  <th>{t("status")}</th>
                  <th>{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.label || s.stationUuid}</td>
                    <td>{t(`role${s.role === "owner" ? "Owner" : "Barber"}`)}</td>
                    <td>{s.isActive ? t("active") : t("inactive")}</td>
                    <td>{s.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {!canManage && <p>{t("noData")}</p>}
      {message && <div className="alert alert-success">{message}</div>}
    </div>
  );
};

export default Settings;
