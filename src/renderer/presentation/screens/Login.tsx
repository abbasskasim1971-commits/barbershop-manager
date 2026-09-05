import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

type LoginMode = "owner" | "barber";

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { login, loginPin } = useAuth();
  const [mode, setMode] = useState<LoginMode>("owner");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(username, password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || t("loginFailed"));
    }
  };

  const handleBarberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await loginPin(pin);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || t("loginFailed"));
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>{t("app")}</h1>
          <p>{mode === "owner" ? t("ownerLogin") : t("barberLogin")}</p>
        </div>

        <div className="login-tabs">
          <button
            className={mode === "owner" ? "active" : ""}
            onClick={() => {
              setMode("owner");
              setError("");
            }}
          >
            {t("ownerManager")}
          </button>
          <button
            className={mode === "barber" ? "active" : ""}
            onClick={() => {
              setMode("barber");
              setError("");
            }}
          >
            {t("barber")}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {mode === "owner" ? (
          <form onSubmit={handleOwnerLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">{t("username")}</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("usernamePlaceholder")}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">{t("password")}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                required
              />
            </div>
            <button type="submit" disabled={isLoading} className="login-btn">
              {isLoading ? t("loggingIn") : t("loginBtn")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleBarberLogin} className="login-form pin-form">
            <div className="form-group">
              <label>{t("pin")}</label>
              <div className="pin-inputs">
                {Array.from({ length: 4 }, (_, i) => (
                  <input
                    key={i}
                    type="password"
                    maxLength={1}
                    value={pin[i] || ""}
                    onChange={(e) => {
                      const newPin = pin.split("");
                      newPin[i] = e.target.value;
                      setPin(newPin.join(""));
                      if (e.target.value && i < 3) {
                        (document.getElementById(`pin-${i + 1}`) as HTMLInputElement)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && i > 0) {
                        (document.getElementById(`pin-${i - 1}`) as HTMLInputElement)?.focus();
                      }
                    }}
                    id={`pin-${i}`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>
            <button type="submit" disabled={isLoading || pin.length < 4} className="login-btn">
              {isLoading ? t("loggingIn") : t("loginBtn")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
