import React, { useEffect, useMemo, useState, useRef } from "react";
import { Eye, Pencil, Trash2, Users } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import api from "../lib/api.js";

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const initialEditState = {
  userId: null,
  name: "",
  email: "",
  role: "marketing",
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editState, setEditState] = useState(initialEditState);
  const [activityUser, setActivityUser] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const usersTableRef = useRef(null);
  const activityTableRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const userRows = useMemo(() => users || [], [users]);

  const handleStartEdit = (user) => {
    setEditState({
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setMessage("");
    setError("");
  };

  const handleCancelEdit = () => {
    setEditState(initialEditState);
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();

    if (!editState.userId) {
      return;
    }

    try {
      await api.put(`/admin/users/${editState.userId}`, {
        name: editState.name,
        email: editState.email,
        role: editState.role,
      });
      setMessage("User updated successfully");
      setEditState(initialEditState);
      await fetchUsers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/users/${user.userId}`);
      setMessage("User deleted successfully");
      setError("");
      if (editState.userId === user.userId) {
        setEditState(initialEditState);
      }
      await fetchUsers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to delete user");
    }
  };

  const handleViewUser = async (user) => {
    try {
      setActivityLoading(true);
      setActivityError("");
      setActivityUser(user);

      const response = await api.get(`/admin/users/${user.userId}/activity`);
      setActivityData(response.data);
    } catch (requestError) {
      setActivityData(null);
      setActivityError(
        requestError.response?.data?.message || "Failed to load user activity",
      );
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">

        <main className="p-8 space-y-6">
          <section>
            <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor all marketing users activity.
            </p>
          </section>

          {message ? (
            <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </section>
          ) : null}

          {error ? (
            <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          ) : null}

          {editState.userId ? (
            <section className="bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
              <form
                className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4"
                onSubmit={handleUpdateUser}
              >
                <input
                  value={editState.name}
                  onChange={(event) =>
                    setEditState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Name"
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="email"
                  value={editState.email}
                  onChange={(event) =>
                    setEditState((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Email"
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={editState.role}
                  onChange={(event) =>
                    setEditState((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="marketing">marketing</option>
                  <option value="admin">admin</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {activityUser ? (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Activity Details: {activityUser.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setActivityUser(null);
                    setActivityData(null);
                    setActivityError("");
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              {activityLoading ? (
                <div className="mt-4 text-sm text-gray-500">
                  Loading activity...
                </div>
              ) : null}

              {activityError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {activityError}
                </div>
              ) : null}

              {activityData && !activityLoading ? (
                <>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500">Last Login</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {formatDateTime(activityData.user?.lastLoginAt)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500">Campaigns Sent</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {activityData.summary?.campaignsSent || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500">Contacts Created</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {activityData.summary?.contactsCreated || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-500">Last Activity</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {formatDateTime(activityData.summary?.lastActivityAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full" ref={activityTableRef}>
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Campaign Name
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Sent Date
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Recipients
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Sent
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Opens
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Clicks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activityData.sentCampaigns || []).map((campaign) => (
                          <tr
                            key={campaign.campaign_id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {campaign.campaign_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDateTime(campaign.sent_date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {campaign.total_recipients || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {campaign.total_sent || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {campaign.total_opened || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {campaign.total_clicked || 0}
                            </td>
                          </tr>
                        ))}

                        {(activityData.sentCampaigns || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan="6"
                              className="px-4 py-8 text-center text-sm text-gray-500"
                            >
                              No sent campaigns found for this user.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <Pagination tableRef={activityTableRef} options={[10, 15, 25, 50]} />
                </>
              ) : null}
            </section>
          ) : null}

          <section className="bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Marketing Users
              </h2>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-sm text-gray-500">
                Loading users...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" ref={usersTableRef}>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Email
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Last Login
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Created
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Last Activity
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((user) => (
                      <tr
                        key={user.userId}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {user.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {user.role}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDateTime(user.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDateTime(user.activity?.lastActivityAt)}
                          <div className="mt-1 text-xs text-gray-500">
                            C:{user.activity?.contactsCreated || 0} | T:
                            {user.activity?.templatesCreated || 0} | M:
                            {user.activity?.campaignsCreated || 0}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewUser(user)}
                              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                              title="View user activity"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(user)}
                              className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {userRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-4 py-8 text-center text-sm text-gray-500"
                        >
                          No marketing users found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination tableRef={usersTableRef} options={[10, 15, 25, 50]} />
          </section>
        </main>
      </div>
    </div>
  );
}

export default UsersPage;
