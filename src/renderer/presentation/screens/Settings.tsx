import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { SyncService, type StationEntry } from "../../application/syncService";
import {
  getWhatsAppConfig,
  setWhatsAppOwnerNumber,
  beginWhatsAppLink,
  stopWhatsAppLink,
} from "../../application/whatsappService";

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { user, getSessionId, isOwner } = useAuth();
  const [label, setLabel] = useState("");
  const [stations, setStations] = useState<StationEntry[]>([]);
  const [newToken, setNewToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [waNumber, setWaNumber] = useState("");
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [waError, setWaError] = useState("");
  const [waBusy, setWaBusy] = useState(false);

  const userRole = user?.role;

  const refreshStations = async () => {
    const sessionId = getSessionId() || "";
    const result = await SyncService.listStations(sessionId);
    setStations(result.stations);
  };

  const refreshWhatsApp = async () => {
    const status = await getWhatsAppConfig();
    setWaStatus(status);
  };

  useEffect(() => {
    void refreshStations();
    void refreshWhatsApp();
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

  const handleSaveWaNumber = async () => {
    setWaError("");
    setMessage("");
    setWaBusy(true);
    const result = await setWhatsAppOwnerNumber(waNumber);
    setWaBusy(false);
    if (result.success) {
      setMessage(t("whatsappSaved"));
      setWaNumber("");
      if (result.status) setWaStatus(result.status);
    } else {
      setWaError(result.error || t("operationFailed"));
    }
  };

  const handleBeginLink = async () => {
    setWaError("");
    setMessage("");
    setWaBusy(true);
    const result = await beginWhatsAppLink();
    setWaBusy(false);
    if (!result.success) setWaError(result.error || t("operationFailed"));
    await refreshWhatsApp();
  };

  const handleStopLink = async () => {
    setWaError("");
    setMessage("");
    setWaBusy(true);
    const result = await stopWhatsAppLink();
    setWaBusy(false);
    if (!result.success) setWaError(result.error || t("operationFailed"));
    await refreshWhatsApp();
  };

  const canManage = userRole === "owner" || userRole === "manager";

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

      {canManage && (
        <section className="settings-section">
          <h2>{t("whatsappSection")}</h2>

          {waStatus?.configured && (
            <table className="data-table whatsapp-status">
              <tbody>
                <tr>
                  <td>{t("whatsappNumberMasked")}</td>
                  <td>{waStatus.numberMasked ?? "-"}</td>
                </tr>
                <tr>
                  <td>{t("whatsappState")}</td>
                  <td>{waStateLabel(waStatus.state, t)}</td>
                </tr>
                {waStatus.lastAttemptAt && (
                  <tr>
                    <td>{t("whatsappLastAttempt")}</td>
                    <td>{waStatus.lastAttemptAt}</td>
                  </tr>
                )}
                {waStatus.lastError && (
                  <tr>
                    <td>{t("whatsappLastError")}</td>
                    <td>{waStatus.lastError}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {waStatus && !waStatus.configured && <p>{t("whatsappNotConfigured")}</p>}

          {isOwner() && (
            <>
              <div className="form-group">
                <label htmlFor="wa-number">{t("whatsappOwnerNumber")}</label>
                <input
                  id="wa-number"
                  type="tel"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder={t("whatsappNumberHint")}
                />
              </div>
              <div className="rate-edit">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveWaNumber}
                  disabled={waBusy}
                >
                  {waBusy ? t("whatsappSaving") : t("whatsappSave")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBeginLink}
                  disabled={waBusy}
                >
                  {waBusy ? t("whatsappLinking") : t("whatsappLink")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleStopLink}
                  disabled={waBusy}
                >
                  {t("whatsappReset")}
                </button>
              </div>
            </>
          )}

          {waError && <div className="alert alert-error">{waError}</div>}
        </section>
      )}

      {!canManage && <p>{t("noData")}</p>}
      {message && <div className="alert alert-success">{message}</div>}
    </div>
  );
};

export default Settings;

function waStateLabel(state: WhatsAppSessionState, t: (arg0: string) => string): string {
  switch (state) {
    case "unlinked":
      return t("waStateUnlinked");
    case "linking":
      return t("waStateLinking");
    case "ready":
      return t("waStateReady");
    case "disconnected":
      return t("waStateDisconnected");
    case "relink-required":
      return t("waStateRelinkRequired");
    default:
      return state;
  }
}
