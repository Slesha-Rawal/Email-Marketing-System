import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import defaultAvatar from "../assets/default-avatar.svg";

function ProfilePage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

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

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(
    resolveAvatarUrl(user?.avatarUrl),
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpContext, setOtpContext] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [pendingProfilePayload, setPendingProfilePayload] = useState(null);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  useEffect(() => {
    setAvatarPreviewUrl(resolveAvatarUrl(user?.avatarUrl));
  }, [user]);

  const shellWrapperClass =
    "relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300";
  const shellInputClass =
    "w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none";

  const normalizedCurrentName = String(user?.name || "").trim();
  const normalizedCurrentEmail = String(user?.email || "")
    .trim()
    .toLowerCase();
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const isEmailChanged = normalizedEmail !== normalizedCurrentEmail;
  const profileHasChanges =
    normalizedName !== normalizedCurrentName || isEmailChanged;
  const isPasswordFormStarted = Boolean(
    currentPassword || newPassword || confirmPassword,
  );
  const isPasswordFormComplete =
    Boolean(currentPassword) &&
    Boolean(newPassword) &&
    Boolean(confirmPassword);

  const isProfileSaveEnabled = profileHasChanges && !isSavingProfile;

  const isPasswordSaveEnabled =
    isPasswordFormComplete &&
    !isSavingPassword &&
    newPassword === confirmPassword;

  const closeOtpModal = () => {
    setIsOtpModalOpen(false);
    setOtpContext(null);
    setOtpCode("");
    setOtpChallengeId("");
    setOtpError("");
    setPendingProfilePayload(null);
  };

  const handleAvatarUploadClick = () => {
    setAvatarError("");
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarError("");

    if (!String(file.type || "").startsWith("image/")) {
      setAvatarError("Please select an image file");
      event.target.value = "";
      return;
    }

    if (Number(file.size || 0) > 5 * 1024 * 1024) {
      setAvatarError("Image must be 5MB or smaller");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await api.put("/auth/profile/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextUser = response?.data?.user || null;
      if (nextUser) {
        login(nextUser);
      }

      setAvatarPreviewUrl(resolveAvatarUrl(nextUser?.avatarUrl));
    } catch (error) {
      setAvatarError(
        error.response?.data?.message || "Failed to upload profile picture",
      );
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError("");

    try {
      setIsRemovingAvatar(true);
      const response = await api.delete("/auth/profile/avatar");
      const nextUser = response?.data?.user || null;

      if (nextUser) {
        login(nextUser);
      }

      setAvatarPreviewUrl(resolveAvatarUrl(nextUser?.avatarUrl));
    } catch (error) {
      setAvatarError(
        error.response?.data?.message || "Failed to remove profile picture",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileError("");

    if (!profileHasChanges) {
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    try {
      setIsSavingProfile(true);
      if (isEmailChanged) {
        const otpResponse = await api.post("/auth/request-account-otp", {
          purpose: "email_change",
          email: normalizedEmail,
        });

        setPendingProfilePayload({
          name: normalizedName,
          email: normalizedEmail,
        });
        setOtpContext("profile");
        setOtpChallengeId(otpResponse.data?.challengeId || "");
        setOtpCode("");
        setOtpError("");
        setIsOtpModalOpen(true);
        return;
      }

      const response = await api.put("/auth/profile", {
        name: normalizedName,
        email: normalizedEmail,
      });

      login(response.data.user);
    } catch (error) {
      setProfileError(
        error.response?.data?.message || "Failed to update basic information",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    if (!isPasswordFormStarted) {
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setIsSavingPassword(true);
      await api.put("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleOtpVerify = async (event) => {
    event.preventDefault();
    setOtpError("");

    if (!/^\d{6}$/.test(String(otpCode || ""))) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setIsVerifyingOtp(true);

      if (otpContext === "profile" && pendingProfilePayload) {
        const response = await api.put("/auth/profile", {
          ...pendingProfilePayload,
          otpChallengeId,
          otp: otpCode,
        });
        login(response.data.user);
      }

      closeOtpModal();
    } catch (error) {
      setOtpError(error.response?.data?.message || "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
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

          <section className="bg-white rounded-md border border-indigo-200/60 p-4 lg:p-5">
            <h2 className="text-base font-semibold text-gray-800">
              Profile Details
            </h2>

            {profileError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            )}

            <form className="mt-5 space-y-5" onSubmit={handleProfileSave}>
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className={`h-24 w-24 overflow-hidden rounded-full flex items-center justify-center ${
                      avatarPreviewUrl
                        ? "border border-gray-200 bg-white"
                        : "bg-transparent"
                    }`}
                  >
                    {avatarPreviewUrl ? (
                      <img
                        src={avatarPreviewUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={defaultAvatar}
                        alt="Default avatar"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={handleAvatarUploadClick}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {isUploadingAvatar ? "Uploading..." : "Upload"}
                    </button>

                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      disabled={isRemovingAvatar || !avatarPreviewUrl}
                      className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isRemovingAvatar ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>

                {avatarError ? (
                  <p className="mt-3 text-sm text-red-600">{avatarError}</p>
                ) : null}
              </div>

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
                  disabled={!isProfileSaveEnabled}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
                >
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-md border border-indigo-200/60 p-4 lg:p-5">
            <h2 className="text-base font-semibold text-gray-800">
              Change Password
            </h2>

            <form className="mt-5 space-y-5" onSubmit={handlePasswordChange}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Old Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type={showOldPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      className={`${shellInputClass} pr-12`}
                      placeholder="Old password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={
                        showOldPassword
                          ? "Hide old password"
                          : "Show old password"
                      }
                    >
                      {showOldPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={`${shellInputClass} pr-12`}
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={
                        showNewPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <div className={shellWrapperClass}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className={`${shellInputClass} pr-12`}
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!isPasswordSaveEnabled}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
                >
                  {isSavingPassword ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          {isOtpModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
              <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-5 shadow-lg">
                <h3 className="text-base font-semibold text-gray-900">
                  Email Verification
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the 6-digit OTP sent to your new email.
                </p>

                {otpError && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {otpError}
                  </div>
                )}

                <form className="mt-4 space-y-4" onSubmit={handleOtpVerify}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      OTP
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(event) =>
                          setOtpCode(event.target.value.replace(/[^0-9]/g, ""))
                        }
                        className={shellInputClass}
                        placeholder="Enter 6-digit OTP"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeOtpModal}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingOtp}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default ProfilePage;
