import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

// Validation function
function validation(values) {
    let errors = {};
    const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (values.email === "") {
        errors.email = "Email should not be empty";
    } else if (!email_pattern.test(values.email)) {
        errors.email = "Invalid email format";
    } else {
        errors.email = "";
    }
    if (values.password === "") {
        errors.password = "Password should not be empty";
    } else {
        errors.password = "";
    }
    return errors;
    }

    function Login() {
    const [values, setValues] = useState({
        email: "",
        password: "",
    });

    const navigate = useNavigate();

    const handleInput = (event) => {
        setValues((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        const validationErrors = validation(values);
        setErrors(validationErrors);

        console.log("Validation errors:", validationErrors);
        console.log("Form values:", values);

        if (validationErrors.email === "" && validationErrors.password === "") {
        // Call backend API to validate credentials
        axios
            .post("http://localhost:3001/login", values)
            .then((res) => {
            console.log("Backend response:", res.data);
            if (res.data === "success") {
                console.log("Login successful");
                navigate("/contact");
            } else {
                console.log("Login failed. Backend returned:", res.data);
                setErrors({ login: "Invalid email or password" });
            }
            })
            .catch((err) => {
            console.error("Login error:", err);
            setErrors({ login: "Server error. Please try again." });
            });
        } else {
        console.log("Form has validation errors");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome!!</h1>
            <p className="text-gray-500">Sign in to send emails</p>
            </div>

            <form action="" onSubmit={handleSubmit}>
            {/* Login Error */}
            {errors.login && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {errors.login}
                </div>
            )}
            {/* Email */}
            <div className="mb-4">
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
                name="email"
                onChange={handleInput}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.email && (
                <span className="text-red-500 text-sm">{errors.email}</span>
                )}
            </div>

            {/* Password */}
            <div className="mb-2">
                <label
                htmlFor="password"
                className="block text-gray-700 text-sm font-medium mb-2"
                >
                Password
                </label>
                <div className="relative">
                <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    name="password"
                    onChange={handleInput}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                    {showPassword ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                        fillRule="evenodd"
                        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                        clipRule="evenodd"
                        />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                    ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                        fillRule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                        clipRule="evenodd"
                        />
                    </svg>
                    )}
                </button>
                </div>
                {errors.password && (
                <span className="text-red-500 text-sm">{errors.password}</span>
                )}
            </div>

            {/* Forgot Password */}
            <div className="text-right mb-6">
                <Link
                to="/forgot-password"
                className="text-sm text-indigo-500 hover:text-indigo-600"
                >
                Forgot password?
                </Link>
            </div>

            {/* Button */}
            <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
            >
                Log In
            </button>
            </form>
        </div>
        </div>
    );
}

export default Login;
