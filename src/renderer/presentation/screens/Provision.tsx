import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SyncService } from "../../application/syncService";

interface ProvisionProps {
  onProvisioned: () => void;
  onOwnerSetup: () => void;
}

const Provision: React.FC<ProvisionProps> = ({ onProvisioned, onOwnerSetup }) => {
  const { t } = useTranslation();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("47812");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const parsedPort = Number.parseInt(port, 10);
    if (!host.trim()) {
      setError(t("provisionHostRequired"));
      return;
    }
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError(t("provisionPortInvalid"));
      return;
    }
    if (!token.trim()) {
      setError(t("provisionTokenRequired"));
      return;
    }
    setIsLoading(true);
    const result = await SyncService.provision(host.trim(), parsedPort, token.trim());
    setIsLoading(false);
    if (result.ok) {
      setSuccess(t("provisionSuccess"));
      setTimeout(onProvisioned, 800);
    } else {
      setError(result.error || t("provisionFailed"));
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>{t("app")}</h1>
          <p>{t("provisionTitle")}</p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="prov-host">{t("provisionHost")}</label>
            <input
              id="prov-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.10"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="prov-port">{t("provisionPort")}</label>
            <input
              id="prov-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="prov-token">{t("provisionToken")}</label>
            <input
              id="prov-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("provisionTokenPlaceholder")}
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="login-btn">
            {isLoading ? t("provisioning") : t("provisionBtn")}
          </button>
        </form>

        <div className="login-footer">
          <p>{t("provisionInfo")}</p>
          <button type="button" className="btn btn-sm btn-outline" onClick={onOwnerSetup}>
            {t("provisionOwnerSetup")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Provision;
