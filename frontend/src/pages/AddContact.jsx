import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { User, Mail, Upload } from "lucide-react";

const AddContact = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleAddContact = async () => {
    if (!name || !email) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/contacts", {
        contact_name: name,
        contact_email: email,
        status: "active",
      });
      alert("Contact added successfully!");
      setName("");
      setEmail("");
      navigate("/contact");
    } catch (error) {
      console.error("Error adding contact:", error);
      alert("Failed to add contact");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/contacts/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      alert(response.data.message);
      setSelectedFile(null);
      document.getElementById("file-upload").value = "";
      navigate("/contact");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(error.response?.data?.message || "Failed to upload file");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Header />

        <div className="flex-1 overflow-auto p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Add Client
            </h1>
            <p className="text-gray-600">
              Add individual contacts or import multiple contacts from a file
            </p>
          </div>

          {/* Add One Contact Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8 transition-all duration-200 hover:shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-3 rounded-xl shadow-md">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Add One Contact
                </h2>
                <p className="text-sm text-gray-600">
                  Manually add a single contact to your list
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleAddContact}
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 hover:shadow-lg font-medium transition-all duration-200 active:scale-95"
              >
                <span className="text-xl font-bold">+</span>
                Add Contact
              </button>
            </div>
          </div>

          {/* Add Multiple Contacts Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 transition-all duration-200 hover:shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-green-600 to-green-700 text-white p-3 rounded-xl shadow-md">
                <Upload size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Bulk Import Contacts
                </h2>
                <p className="text-sm text-gray-600">
                  Upload a CSV or Excel file to import multiple contacts at once
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select File to Import
              </label>

              <div className="border-3 border-dashed border-gray-300 rounded-xl p-16 text-center mb-8 bg-gradient-to-br from-gray-50 to-white hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300 group">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-full shadow-md mb-4 group-hover:shadow-lg transition-all duration-300">
                      <Upload className="w-12 h-12 text-indigo-600 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 mb-1">
                      CSV or Excel (XLSX, XLS) files only
                    </p>
                    <p className="text-xs text-gray-400">
                      Maximum file size: 10MB
                    </p>
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg inline-block">
                        <p className="text-sm text-indigo-700 font-medium">
                          ✓ Selected: {selectedFile.name}
                        </p>
                        <p className="text-xs text-indigo-600 mt-1">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleUpload}
                  className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 hover:shadow-lg font-medium transition-all duration-200 active:scale-95"
                >
                  <Upload className="w-5 h-5" />
                  Import Contacts
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Make sure your file has columns:{" "}
                  <code className="px-2 py-1 bg-gray-100 rounded font-mono text-gray-700">
                    name
                  </code>
                  ,{" "}
                  <code className="px-2 py-1 bg-gray-100 rounded font-mono text-gray-700">
                    email
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddContact;
