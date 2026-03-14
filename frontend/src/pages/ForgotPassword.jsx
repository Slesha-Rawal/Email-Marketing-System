import React, { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    // TODO: Implement password reset logic
    setMessage("Password reset link has been sent to your email");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Reset Password
          </h1>
          <p className="text-sm text-gray-500">
            Enter your email to receive a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="mb-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Send Reset Link
          </button>

          <div className="text-center">
            <Link
              to="/"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
