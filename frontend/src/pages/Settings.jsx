import React, { useEffect, useMemo, useState } from "react";
import { Save, Settings as SettingsIcon } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";

const FIXED_SENDER_NAME = "HomeSchool.Asia";

const defaultSmtpSettings = {
  emailProvider: "gmail",
  smtpServer: "",
  smtpPort: "587",
  usernameEmail: "",
  password: "",
  senderName: FIXED_SENDER_NAME,
};

function SettingsPage() {
  const [settingsForm, setSettingsForm] = useState(defaultSmtpSettings);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [isLoadingSmtpConfig, setIsLoadingSmtpConfig] = useState(true);

  useEffect(() => {
    const loadSmtpConfig = async () => {
      try {
        const response = await api.get("/auth/smtp-config");
        setSettingsForm((prev) => ({
          ...prev,
          ...response.data,
          senderName: FIXED_SENDER_NAME,
        }));
      } catch (error) {
        setSettingsError(
          error.response?.data?.message ||
            "Unable to load SMTP settings from environment",
        );
      } finally {
        setIsLoadingSmtpConfig(false);
      }
    };

    loadSmtpConfig();
  }, []);

  const shellWrapperClass =
    "relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300";
  const shellInputClass =
    "w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none";

  const providerHint = useMemo(() => {
    if (settingsForm.emailProvider === "gmail") {
      return "For Gmail, use an App Password for better security.";
    }

    if (settingsForm.emailProvider === "outlook") {
      return "Use smtp.office365.com with TLS port 587 for Outlook/Microsoft 365.";
    }

    if (settingsForm.emailProvider === "zoho") {
      return "Use smtp.zoho.com and ensure SMTP access is enabled in your account.";
    }

    return "Use your provider SMTP host, port, and account credentials.";
  }, [settingsForm.emailProvider]);

  const updateSettingsField = (field, value) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSettingsSave = (event) => {
    event.preventDefault();
    setSettingsMessage("");
    setSettingsError("");

    if (
      !settingsForm.smtpServer.trim() ||
      !settingsForm.smtpPort.trim() ||
      !settingsForm.usernameEmail.trim() ||
      !settingsForm.password.trim() ||
      !settingsForm.senderName.trim()
    ) {
      setSettingsError("Please fill all required SMTP settings fields.");
      return;
    }

    setSettingsMessage(
      "SMTP fields are prefilled from backend environment credentials.",
    );
  };

  const handleSettingsReset = async () => {
    setSettingsMessage("");
    setSettingsError("");

    try {
      setIsLoadingSmtpConfig(true);
      const response = await api.get("/auth/smtp-config");
      setSettingsForm((prev) => ({
        ...prev,
        ...response.data,
        senderName: FIXED_SENDER_NAME,
      }));
    } catch (error) {
      setSettingsError(
        error.response?.data?.message ||
          "Unable to reload SMTP settings from environment",
      );
    } finally {
      setIsLoadingSmtpConfig(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8 space-y-6 max-w-7xl">
          <section>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage email service configuration.
            </p>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-semibold text-gray-900">
                Email Service Configuration
              </h2>
            </div>

            <div className="px-6 py-5 space-y-5">
              {settingsMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {settingsMessage}
                </div>
              )}
              {settingsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {settingsError}
                </div>
              )}

              {isLoadingSmtpConfig && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                  Loading SMTP credentials from environment...
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSettingsSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email Provider
                    </label>
                    <div className={shellWrapperClass}>
                      <select
                        value={settingsForm.emailProvider}
                        onChange={(event) =>
                          updateSettingsField(
                            "emailProvider",
                            event.target.value,
                          )
                        }
                        className={`${shellInputClass} pr-10 cursor-pointer`}
                      >
                        <option value="gmail">Gmail</option>
                        <option value="outlook">Outlook</option>
                        <option value="zoho">Zoho</option>
                        <option value="custom">Custom SMTP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      SMTP Server
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="text"
                        value={settingsForm.smtpServer}
                        onChange={(event) =>
                          updateSettingsField("smtpServer", event.target.value)
                        }
                        className={shellInputClass}
                        placeholder="smtp.gmail.com or smtp.zoho.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      SMTP Port
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="text"
                        value={settingsForm.smtpPort}
                        onChange={(event) =>
                          updateSettingsField("smtpPort", event.target.value)
                        }
                        className={shellInputClass}
                        placeholder="587 or 465"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Common ports: 587 (TLS), 465 (SSL)
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Username / Email
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="email"
                        value={settingsForm.usernameEmail}
                        onChange={(event) =>
                          updateSettingsField(
                            "usernameEmail",
                            event.target.value,
                          )
                        }
                        className={shellInputClass}
                        placeholder="your.email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="password"
                        value={settingsForm.password}
                        onChange={(event) =>
                          updateSettingsField("password", event.target.value)
                        }
                        className={shellInputClass}
                        placeholder="SMTP password or app password"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{providerHint}</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Sender Name
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="text"
                        value={settingsForm.senderName}
                        readOnly
                        className={shellInputClass}
                        placeholder="HomeSchool.Asia"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Fixed sender name for outgoing emails.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSettingsReset}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Save className="h-4 w-4" />
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
