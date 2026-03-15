import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload, User, X } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/Header.jsx";
import api from "../lib/api.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AddContact = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleAddContact = async () => {
    setMessage("");
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }

    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }

    try {
      await api.post("/contacts", {
        contact_name: name.trim(),
        contact_email: email.trim().toLowerCase(),
        contact_status: "active",
      });
      setMessage("Contact added successfully");
      setName("");
      setEmail("");
      setTimeout(() => navigate("/contact"), 500);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Failed to add contact");
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    const input = document.getElementById("file-upload");
    if (input) {
      input.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first");
      return;
    }

    setMessage("");
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/contacts/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage(response.data.message);
      setSelectedFile(null);
      const input = document.getElementById("file-upload");
      if (input) {
        input.value = "";
      }
      setTimeout(() => navigate("/contact"), 500);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to upload file");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <main className="p-8 space-y-6">
          <section>
            <h1 className="text-2xl font-semibold text-gray-900">
              Add Contacts
            </h1>

            {message && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-5">
              <User className="h-4 w-4 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Add One Contact
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleAddContact}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </button>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-5">
              <Upload className="h-4 w-4 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Import Contacts (CSV)
              </h2>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-5 w-5 text-gray-500" />
                <p className="text-sm text-gray-700">
                  Click to select a CSV file
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Required columns: name, email
                </p>
              </label>

              {selectedFile && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="text-sm font-medium text-indigo-700">
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveSelectedFile}
                    className="inline-flex items-center rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Remove selected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUpload}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" />
                Import Contacts
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AddContact;
