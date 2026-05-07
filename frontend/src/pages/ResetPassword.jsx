import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import api from "../lib/api.js";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams],
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isPasswordValid = newPassword.length >= 8;
  const passwordsMatch =
    newPassword === confirmPassword && newPassword.length > 0;

  useEffect(() => {
    let isCancelled = false;

    const validateToken = async () => {
      if (!token) {
        if (!isCancelled) {
          setIsTokenValid(false);
          setError("Invalid or expired reset link");
          setIsCheckingToken(false);
        }
        return;
      }

      try {
        await api.post(
          "/auth/forgot-password/validate-token",
          { token },
          {
            meta: {
              skipSuccessToast: true,
              skipErrorToast: true,
            },
          },
        );

        if (!isCancelled) {
          setIsTokenValid(true);
          setError("");
        }
      } catch (_requestError) {
        if (!isCancelled) {
          setIsTokenValid(false);
          setError("Invalid or expired reset link");
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingToken(false);
        }
      }
    };

    validateToken();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isTokenValid) {
      setError("Invalid or expired reset link");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill all password fields");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(
        "/auth/forgot-password/reset-with-token",
        {
          token,
          newPassword,
        },
        {
          meta: {
            skipErrorToast: true,
          },
        },
      );

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to reset password right now",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Set New Password
          </h1>
          <p className="text-sm text-gray-500">
            Choose a strong password to secure your account.
          </p>
        </div>

        {isCheckingToken ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Verifying reset link...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={!isTokenValid}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={!isTokenValid}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {newPassword && (
                <p
                  className={`mt-2 text-sm ${
                    isPasswordValid ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPasswordValid
                    ? "✓ Password meets minimum length requirement"
                    : `✗ Password must be at least 8 characters (${newPassword.length}/8)`}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={!isTokenValid}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={!isTokenValid}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {confirmPassword && (
                <p
                  className={`mt-2 text-sm ${
                    passwordsMatch ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {passwordsMatch
                    ? "✓ Passwords match"
                    : "✗ Passwords do not match"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                !isTokenValid ||
                isSubmitting ||
                !isPasswordValid ||
                !passwordsMatch
              }
              className="mb-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Please wait..." : "Reset Password"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
