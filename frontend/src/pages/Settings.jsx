import React, { useState } from "react";
import { Save, Shield } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

function SettingsPage() {
  const { user, login } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (!name.trim() || !email.trim()) {
      setProfileError("Name and email are required");
      return;
    }

    try {
      const response = await api.put("/auth/profile", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });

      login(response.data.user);
      setProfileMessage("Basic information updated successfully");
    } catch (error) {
      setProfileError(
        error.response?.data?.message || "Failed to update basic information",
      );
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    try {
      const response = await api.put("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setPasswordMessage(
        response.data.message || "Password changed successfully",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || "Failed to change password",
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">

        <main className="p-8 space-y-6">
          <section>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your profile details and account security.
            </p>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Basic Information
            </h2>

            {profileMessage && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleProfileSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Change Password
              </h2>
            </div>

            {passwordMessage && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handlePasswordChange}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Current password"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Shield className="h-4 w-4" />
                  Update Password
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
