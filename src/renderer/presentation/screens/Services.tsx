import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getAllServices,
  createService,
  updateService,
  softDeleteService,
} from "../../application/serviceService";

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const Services: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessServices } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadServices = async () => {
    try {
      const result = await getAllServices(100, 0, false);
      setServices(result);
    } catch (error) {
      setError(t("failedToLoad"));
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (editingService) {
        const result = await updateService(
          editingService.id,
          name,
          description,
          parseInt(price) || 0,
        );
        if (result.changes > 0) {
          setSuccess(t("serviceUpdated"));
          setEditingService(null);
        } else {
          setError(t("updateFailed"));
        }
      } else {
        const result = await createService(name, description, parseInt(price) || 0);
        if (result.lastInsertRowid) {
          setSuccess(t("serviceCreated"));
        } else {
          setError(t("createFailed"));
        }
      }
      setName("");
      setDescription("");
      setPrice("");
      setShowForm(false);
      loadServices();
    } catch (error) {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description);
    setPrice(service.price.toString());
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      const result = await softDeleteService(id);
      if (result.changes > 0) {
        setSuccess(t("serviceDeleted"));
        loadServices();
      } else {
        setError(t("deleteFailed"));
      }
    } catch (error) {
      setError(t("deleteFailed"));
    }
  };

  const cancelEdit = () => {
    setEditingService(null);
    setName("");
    setDescription("");
    setPrice("");
    setShowForm(false);
  };

  if (!canAccessServices()) {
    return (
      <div className="screen services">
        <h1>{t("services")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen services">
      <div className="screen-header">
        <h1>{t("services")}</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingService(null);
            setName("");
            setDescription("");
            setPrice("");
          }}
        >
          {t("add")}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="form-modal">
          <h2>{editingService ? t("editService") : t("addService")}</h2>
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
              />
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
            <div className="form-group">
              <label htmlFor="price">{t("price")} (IQD)</label>
              <input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                min="0"
                step="1"
                placeholder={t("pricePlaceholder")}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? t("saving") : editingService ? t("update") : t("save")}
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
              <th>{t("description")}</th>
              <th>{t("price")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>{service.name}</td>
                <td>{service.description || "-"}</td>
                <td>{service.price.toLocaleString()} IQD</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEdit(service)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(service.id)}
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

      {services.length === 0 && !showForm && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default Services;
