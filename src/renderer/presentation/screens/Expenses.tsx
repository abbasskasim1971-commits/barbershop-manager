import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  softDeleteExpense,
} from "../../application/expenseService";
import { getExpenseCategories } from "../../application/expenseCategoryService";

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseCategory {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

const Expenses: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessExpenses } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadExpenses = async () => {
    try {
      const [expensesResult, categoriesResult] = await Promise.all([
        getAllExpenses(100, 0, false),
        getExpenseCategories(),
      ]);
      setExpenses(expensesResult);
      setCategories(categoriesResult);
    } catch (error) {
      setError(t("failedToLoad"));
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (editingExpense) {
        const result = await updateExpense(
          editingExpense.id,
          category,
          parseFloat(amount) || 0,
          description,
        );
        if (result.success) {
          setSuccess(t("expenseUpdated"));
          setEditingExpense(null);
        } else {
          setError(result.error || t("updateFailed"));
        }
      } else {
        const result = await createExpense(category, parseFloat(amount) || 0, description);
        if (result.success) {
          setSuccess(t("expenseCreated"));
        } else {
          setError(result.error || t("createFailed"));
        }
      }
      setCategory("");
      setAmount("");
      setDescription("");
      setShowForm(false);
      loadExpenses();
    } catch (error) {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setCategory(expense.category);
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      const result = await softDeleteExpense(id);
      if (result.success) {
        setSuccess(t("expenseDeleted"));
        loadExpenses();
      } else {
        setError(t("deleteFailed"));
      }
    } catch (error) {
      setError(t("deleteFailed"));
    }
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setCategory("");
    setAmount("");
    setDescription("");
    setShowForm(false);
  };

  if (!canAccessExpenses()) {
    return (
      <div className="screen expenses">
        <h1>{t("expenses")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen expenses">
      <div className="screen-header">
        <h1>{t("expenses")}</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingExpense(null);
            setCategory("");
            setAmount("");
            setDescription("");
          }}
        >
          {t("add")}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="form-modal">
          <h2>{editingExpense ? t("editExpense") : t("addExpense")}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">{t("category")}</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">{t("selectCategory")}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="amount">{t("amount")} (IQD)</label>
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="1"
                  step="1"
                  placeholder={t("amountPlaceholder")}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="description">{t("description")}</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? t("saving") : editingExpense ? t("update") : t("save")}
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
              <th>{t("category")}</th>
              <th>{t("amount")}</th>
              <th>{t("description")}</th>
              <th>{t("createdAt")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.category}</td>
                <td>{expense.amount.toLocaleString()} IQD</td>
                <td>{expense.description || "-"}</td>
                <td>
                  {new Date(expense.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Baghdad",
                  })}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEdit(expense)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(expense.id)}
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

      {expenses.length === 0 && !showForm && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default Expenses;
