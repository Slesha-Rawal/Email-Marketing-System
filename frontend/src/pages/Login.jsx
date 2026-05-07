import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleInput = (event) => {
    setValues((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = validation(values);
    setErrors(validationErrors);

    if (validationErrors.email === "" && validationErrors.password === "") {
      setIsSubmitting(true);
      api
        .post("/auth/login", {
          email: values.email.trim().toLowerCase(),
          password: values.password,
        })
        .then((res) => {
          if (res.data?.otpRequired) {
            setIsOtpStep(true);
            setOtpCode("");
            setOtpError("");
            setOtpInfo(res.data?.message || "OTP sent to your email");
            return;
          }

          login(res.data);
          navigate("/");
        })
        .catch(() => {})
        .finally(() => {
          setIsSubmitting(false);
        });
    }
  };

  const handleOtpVerify = (event) => {
    event.preventDefault();
    setOtpError("");

    if (!/^\d{6}$/.test(String(otpCode || ""))) {
      setOtpError("Enter a valid 6-digit OTP");
      return;
    }

    setIsSubmitting(true);
    api
      .post("/auth/verify-login-otp", { otp: otpCode })
      .then((res) => {
        login(res.data);
        navigate("/");
      })
      .catch((error) => {
        setOtpError(error.response?.data?.message || "OTP verification failed");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleOtpResend = () => {
    setOtpError("");
    setOtpInfo("");
    setIsSubmitting(true);

    api
      .post("/auth/resend-otp")
      .then((res) => {
        setOtpInfo(res.data?.message || "A new OTP has been sent");
      })
      .catch((error) => {
        setOtpError(error.response?.data?.message || "Unable to resend OTP");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-2 text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="mb-0 text-center">HSA Mail</CardTitle>
            </div>
            <CardDescription>
              <span className="text-black">
                Sign in to access your email marketing workspace
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              action=""
              onSubmit={isOtpStep ? handleOtpVerify : handleSubmit}
            >
              {isOtpStep ? (
                <>
                  <div className="mb-4">
                    <label
                      htmlFor="otp"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      One-Time Password
                    </label>
                    <div className="rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otpCode}
                        onChange={(event) =>
                          setOtpCode(event.target.value.replace(/[^0-9]/g, ""))
                        }
                        className="border-none bg-transparent px-3 py-2.5 text-gray-700 placeholder:text-gray-500 focus-visible:ring-0"
                      />
                    </div>
                    {otpInfo ? (
                      <p className="mt-2 text-sm text-gray-600">{otpInfo}</p>
                    ) : null}
                    {otpError ? (
                      <span className="text-red-500 text-sm">{otpError}</span>
                    ) : null}
                  </div>

                  <div className="mb-6 text-right">
                    <button
                      type="button"
                      onClick={handleOtpResend}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Resend OTP
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Email */}
                  <div className="mb-4">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Email Address
                    </label>
                    <div className="rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        name="email"
                        onChange={handleInput}
                        className="border-none bg-transparent px-3 py-2.5 text-gray-700 placeholder:text-gray-500 focus-visible:ring-0"
                      />
                    </div>
                    {errors.email && (
                      <span className="text-red-500 text-sm">
                        {errors.email}
                      </span>
                    )}
                  </div>

                  {/* Password */}
                  <div className="mb-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Password
                    </label>
                    <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        name="password"
                        onChange={handleInput}
                        className="border-none bg-transparent px-3 py-2.5 pr-12 text-gray-700 placeholder:text-gray-500 focus-visible:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
                      <span className="text-red-500 text-sm">
                        {errors.password}
                      </span>
                    )}
                  </div>

                  {/* Forgot Password */}
                  <div className="text-right mb-6">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </>
              )}

              {/* Button */}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                <span className="inline-flex items-center justify-center gap-2">
                  {isSubmitting && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  {isSubmitting
                    ? isOtpStep
                      ? "Verifying..."
                      : "Signing in..."
                    : isOtpStep
                      ? "Verify OTP"
                      : "Log In"}
                </span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Login;
