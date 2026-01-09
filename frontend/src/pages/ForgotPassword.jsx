import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

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
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Forgot Password?
            </h1>
            <p className="text-gray-500">
                Enter your email to reset your password
            </p>
            </div>

            <form onSubmit={handleSubmit}>
            {message && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                {message}
                </div>
            )}
            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
                </div>
            )}

            <div className="mb-6">
                <label
                htmlFor="email"
                className="block text-gray-700 text-sm font-medium mb-2"
                >
                Email Address
                </label>
                <input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition mb-4"
            >
                Send Reset Link
            </button>

            <div className="text-center">
                <Link
                to="/"
                className="text-sm text-indigo-500 hover:text-indigo-600"
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
