import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const { listUsers, createUser, deactivateUser } = useAuth();
  const [users, setUsers] = useState<
    { id: number; username: string; role: string; isActive: number; createdAt: string }[]
  >([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"owner" | "manager" | "barber">("barber");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = async () => {
    const result = await listUsers();
    setUsers(result.users);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    const result = await createUser(
      newUsername,
      newRole,
      newPassword || undefined,
      newPin || undefined,
    );
    setIsLoading(false);

    if (result.success) {
      setSuccess(t("userCreated"));
      setNewUsername("");
      setNewPassword("");
      setNewPin("");
      setShowAddForm(false);
      loadUsers();
    } else {
      setError(result.error || t("createUserFailed"));
    }
  };

  const handleDeactivate = async (userId: number) => {
    if (!window.confirm(t("confirmDeactivate"))) return;

    const result = await deactivateUser(userId);
    if (result.success) {
      setSuccess(t("userDeactivated"));
      loadUsers();
    } else {
      setError(result.error || t("deactivateFailed"));
    }
  };

  return (
    <div className="screen user-management">
      <div className="screen-header">
        <h1>{t("userManagement")}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>{t("username")}</th>
              <th>{t("role")}</th>
              <th>{t("status")}</th>
              <th>{t("createdAt")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>{t(user.role)}</span>
                </td>
                <td>
                  <span className={user.isActive ? "status-active" : "status-inactive"}>
                    {user.isActive ? t("active") : t("inactive")}
                  </span>
                </td>
                <td>
                  {new Date(user.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Baghdad",
                  })}
                </td>
                <td>
                  {!user.isActive ? (
                    <span className="text-muted">{t("deactivated")}</span>
                  ) : user.role !== "owner" ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeactivate(user.id)}
                      disabled={isLoading}
                    >
                      {t("deactivate")}
                    </button>
                  ) : (
                    <span className="text-muted">{t("cannotDeactivateOwner")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="add-user-section">
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? t("cancel") : t("addUser")}
        </button>

        {showAddForm && (
          <form onSubmit={handleCreateUser} className="add-user-form">
            <h3>{t("addUser")}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>{t("username")}</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t("role")}</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "owner" | "manager" | "barber")}
                >
                  <option value="manager">{t("manager")}</option>
                  <option value="barber">{t("barber")}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t("password")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("optional")}
                />
              </div>
              <div className="form-group">
                <label>{t("pin")}</label>
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={t("forBarbers")}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !newUsername}
              >
                {isLoading ? t("creating") : t("createUser")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
