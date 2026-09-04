import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getAllExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  softDeleteExpenseCategory,
} from "../../application/expenseCategoryService";

interface ExpenseCategory {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

const ExpenseCategories: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessExpenseCategories } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadCategories = async () => {
    try {
      const result = await getAllExpenseCategories(100, 0, false);
      setCategories(result);
    } catch (error) {
      setError(t("failedToLoad"));
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (editingCategory) {
        const result = await updateExpenseCategory(editingCategory.id, name);
        if (result.success) {
          setSuccess(t("categoryUpdated"));
          setEditingCategory(null);
        } else {
          setError(result.error || t("updateFailed"));
        }
      } else {
        const result = await createExpenseCategory(name);
        if (result.success) {
          setSuccess(t("categoryCreated"));
        } else {
          setError(result.error || t("createFailed"));
        }
      }
      setName("");
      setShowForm(false);
      loadCategories();
    } catch (error) {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      const result = await softDeleteExpenseCategory(id);
      if (result.success) {
        setSuccess(t("categoryDeleted"));
        loadCategories();
      } else {
        setError(t("deleteFailed"));
      }
    } catch (error) {
      setError(t("deleteFailed"));
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setName("");
    setShowForm(false);
  };

  if (!canAccessExpenseCategories()) {
    return (
      <div className="screen expense-categories">
        <h1>{t("expenseCategories")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen expense-categories">
      <div className="screen-header">
        <h1>{t("expenseCategories")}</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingCategory(null);
            setName("");
          }}
        >
          {t("add")}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="form-modal">
          <h2>{editingCategory ? t("editCategory") : t("addCategory")}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">{t("name")}</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? t("saving") : editingCategory ? t("update") : t("save")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("status")}</th>
              <th>{t("createdAt")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.name}</td>
                <td>
                  <span className={category.isDeleted ? "status-inactive" : "status-active"}>
                    {category.isDeleted ? t("inactive") : t("active")}
                  </span>
                </td>
                <td>{new Date(category.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEdit(category)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(category.id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categories.length === 0 && !showForm && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default ExpenseCategories;
