import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, PencilLine, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import api from "../lib/api.js";
import defaultAvatar from "../assets/default-avatar.svg";

const formatDate = (value) => {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatRoleLabel = (role = "") =>
  role === "admin" ? "Admin" : role === "users" ? "User" : role;

const resolveAvatarUrl = (value) => {
  const source = String(value || "").trim();

  if (!source) {
    return "";
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }

  const baseUrl = String(api.defaults.baseURL || "").trim();
  const origin = baseUrl.replace(/\/api\/?$/, "");
  const normalizedPath = source.startsWith("/") ? source : `/${source}`;
  return `${origin}${normalizedPath}`;
};

const initialModalState = {
  open: false,
  mode: "create",
  userId: null,
  name: "",
  email: "",
  role: "users",
  password: "",
};

function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(initialModalState);

  const usersTableRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      const nextUsers = Array.isArray(response.data) ? response.data : [];
      setUsers(nextUsers);
      setError("");
    } catch (requestError) {
      console.error("Failed to load users:", requestError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const rows = useMemo(() => users || [], [users]);

  const openCreateModal = () => {
    setError("");
    setModal({
      open: true,
      mode: "create",
      userId: null,
      name: "",
      email: "",
      role: "users",
      password: "",
    });
  };

  const openEditModal = (user) => {
    setError("");
    setModal({
      open: true,
      mode: "edit",
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setModal(initialModalState);
  };

  const handleModalChange = (field, value) => {
    setModal((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitModal = async (event) => {
    event.preventDefault();

    const name = String(modal.name || "").trim();
    const email = String(modal.email || "")
      .trim()
      .toLowerCase();
    const role = String(modal.role || "")
      .trim()
      .toLowerCase();
    const password = String(modal.password || "");

    if (!name || !email || !role) {
      setError("Name, email, and role are required.");
      return;
    }

    if (modal.mode === "create" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setSubmitting(true);

      if (modal.mode === "create") {
        await api.post("/admin/users", {
          name,
          email,
          role,
          password,
        });
      } else {
        await api.put(`/admin/users/${modal.userId}`, {
          name,
          email,
          role,
        });
      }

      setError("");
      setModal(initialModalState);
      await fetchUsers();
    } catch (requestError) {
      console.error(
        `Failed to ${modal.mode === "create" ? "create" : "update"} user:`,
        requestError,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const ok = window.confirm(`Delete ${user.name}? This cannot be undone.`);
    if (!ok) {
      return;
    }

    try {
      await api.delete(`/admin/users/${user.userId}`);
      setError("");
      await fetchUsers();
    } catch (requestError) {
      console.error("Failed to delete user:", requestError);
    }
  };

  const handleViewActivity = (user) => {
    navigate(`/users/${user.userId}/activity`);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="ml-64 flex-1">
        <main className="p-8">
          <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Manage Users</h1>
              <p className="mt-2 text-sm text-gray-500">
                Manage system users and administrators.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add New User/Admin
            </button>
          </section>

          {error ? (
            <section className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          ) : null}

          <section className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
            {loading ? (
              <div className="px-6 py-10 text-sm text-gray-500">
                Loading users...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full" ref={usersTableRef}>
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-100">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Last Login
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  user.avatarUrl
                                    ? resolveAvatarUrl(user.avatarUrl)
                                    : defaultAvatar
                                }
                                alt={
                                  user.avatarUrl
                                    ? `${user.name} avatar`
                                    : "Default avatar"
                                }
                                className="h-9 w-9 rounded-full object-cover"
                              />
                              <span className="truncate">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                                user.role === "admin"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {formatRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(user.lastLoginAt)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewActivity(user)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                title="View activity"
                                aria-label={`View activity for ${user.name}`}
                              >
                                <Activity className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                title="Edit user"
                                aria-label={`Edit ${user.name}`}
                              >
                                <PencilLine className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                title="Delete user"
                                aria-label={`Delete ${user.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-6 py-10 text-center text-sm text-gray-500"
                          >
                            No users found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <Pagination tableRef={usersTableRef} options={[15, 30, 50]} />
              </>
            )}
          </section>
        </main>
      </div>

      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {modal.mode === "create" ? "Add New User/Admin" : "Edit User"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </label>
                <input
                  type="text"
                  value={modal.name}
                  onChange={(event) =>
                    handleModalChange("name", event.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Email
                </label>
                <input
                  type="email"
                  value={modal.email}
                  onChange={(event) =>
                    handleModalChange("email", event.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Role
                </label>
                <select
                  value={modal.role}
                  onChange={(event) =>
                    handleModalChange("role", event.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
                >
                  <option value="users">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {modal.mode === "create" ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Password
                  </label>
                  <input
                    type="password"
                    value={modal.password}
                    onChange={(event) =>
                      handleModalChange("password", event.target.value)
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting
                    ? modal.mode === "create"
                      ? "Creating..."
                      : "Saving..."
                    : modal.mode === "create"
                      ? "Create"
                      : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default UsersPage;
