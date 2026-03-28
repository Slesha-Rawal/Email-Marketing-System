import React, { useEffect, useState } from "react";
import { Save, Shield } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

function ProfilePage() {
  const { user, login } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  const shellWrapperClass =
    "relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300";
  const shellInputClass =
    "w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none";

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
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8 space-y-6 max-w-7xl">
          <section>
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your profile details and account security.
            </p>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Profile Details
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

            <form className="mt-5 space-y-5" onSubmit={handleProfileSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={shellInputClass}
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={shellInputClass}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  Save Profile
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
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

            <form className="mt-5 space-y-5" onSubmit={handlePasswordChange}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      className={shellInputClass}
                      placeholder="Current password"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={shellInputClass}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className={shellInputClass}
                      placeholder="Re-enter new password"
                    />
                  </div>
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

export default ProfilePage;
