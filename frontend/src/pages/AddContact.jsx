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
            }
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
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Add Client</h1>

            {/* Add One Contact Section */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                Add one Contact
                </h2>

                <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                    </label>
                    <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Enter Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                    </label>
                    <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="email"
                        placeholder="Enter your email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    </div>
                </div>
                </div>

                <div className="flex justify-center">
                <button
                    onClick={handleAddContact}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                >
                    <span className="text-lg">+</span>
                    Add contact
                </button>
                </div>
            </div>

            {/* Add Multiple Contacts Section */}
            <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                Add Multiple Contacts
                </h2>

                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSV File
                </label>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6">
                    <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                        <Upload className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-700 font-medium mb-1">
                        Upload a file
                        </p>
                        <p className="text-sm text-gray-500">
                        CSV or Excel (XLSX) files only
                        </p>
                        {selectedFile && (
                        <p className="text-sm text-indigo-600 mt-2">
                            Selected: {selectedFile.name}
                        </p>
                        )}
                    </div>
                    </label>
                </div>

                <div className="flex justify-center">
                    <button
                    onClick={handleUpload}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                    >
                    <Upload className="w-4 h-4" />
                    Upload File
                    </button>
                </div>
                </div>
            </div>
            </div>
        </div>
        </div>
    );
};

export default AddContact;
