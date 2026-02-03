import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Search, Plus, Edit2, Trash2, User } from "lucide-react";

function Contact() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentContact, setCurrentContact] = useState(null);
    const [formData, setFormData] = useState({
        contact_name: "",
        contact_email: "",
        status: "Active",
    });

  // Fetch contacts from backend
    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
        const response = await axios.get("http://localhost:3001/api/contacts");
        setContacts(response.data);
        } catch (error) {
        console.error("Error fetching contacts:", error);
        }
    };

    // Add new contact
    const handleAddContact = async (e) => {
        e.preventDefault();
        try {
        await axios.post("http://localhost:3001/api/contacts", formData);
        setShowAddModal(false);
        setFormData({ contact_name: "", contact_email: "", status: "Active" });
        fetchContacts();
        } catch (error) {
        console.error("Error adding contact:", error);
        }
    };

    // Update contact
    const handleUpdateContact = async (e) => {
        e.preventDefault();
        try {
        await axios.put(
            `http://localhost:3001/api/contacts/${currentContact.contact_id}`,
            formData
        );
        setShowEditModal(false);
        setCurrentContact(null);
        setFormData({ contact_name: "", contact_email: "", status: "Active" });
        fetchContacts();
        } catch (error) {
        console.error("Error updating contact:", error);
        }
    };

    // Delete contact
    const handleDeleteContact = async (id) => {
        if (window.confirm("Are you sure you want to delete this contact?")) {
        try {
            await axios.delete(`http://localhost:3001/api/contacts/${id}`);
            fetchContacts();
        } catch (error) {
            console.error("Error deleting contact:", error);
        }
        }
    };

    // Open edit modal with contact data
    const openEditModal = (contact) => {
        setCurrentContact(contact);
        setFormData({
        contact_name: contact.contact_name,
        contact_email: contact.contact_email,
        status: contact.status,
        });
        setShowEditModal(true);
    };

    const toggleContact = (id) => {
        setSelectedContacts((prev) =>
        prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        setSelectedContacts(
        selectedContacts.length === contacts.length
            ? []
            : contacts.map((c) => c.contact_id)
        );
    };

    const filteredContacts = contacts.filter(
        (contact) =>
        contact.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.contact_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-gray-50">
        {/* Sidebar Component */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 ml-64 flex flex-col">
            <Header />

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8">
            {/* Page Title and Action Bar */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
                <button
                onClick={() => navigate("/add-contact")}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium"
                >
                <Plus className="w-5 h-5" />
                Add new contact
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                    type="text"
                    placeholder="Search Contacts"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                </div>
            </div>

            {/* Contacts Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                    {/* <th className="px-6 py-4 text-left">
                        <input
                        type="checkbox"
                        checked={selectedContacts.length === contacts.length}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300"
                        />
                    </th> */}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Added Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                        Actions
                    </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                    <tr key={contact.contact_id} className="hover:bg-gray-50">
                        {/* <td className="px-6 py-4">
                        <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.contact_id)}
                            onChange={() => toggleContact(contact.contact_id)}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        </td> */}
                        <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                            </div>
                            <span className="font-medium text-gray-900">
                            {contact.contact_name}
                            </span>
                        </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                        {contact.contact_email}
                        </td>
                        <td className="px-6 py-4">
                        <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            contact.status === "Active"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-red-100 text-red-700"
                            }`}
                        >
                            {contact.status}
                        </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                        {new Date(contact.added_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <button
                            onClick={() => openEditModal(contact)}
                            className="text-gray-400 hover:text-indigo-600"
                            >
                            <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                            onClick={() =>
                                handleDeleteContact(contact.contact_id)
                            }
                            className="text-gray-400 hover:text-red-600"
                            >
                            <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>
        </div>

        {/* Add Contact Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6">Add New Contact</h2>
                <form onSubmit={handleAddContact}>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Name
                    </label>
                    <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Email
                    </label>
                    <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) =>
                        setFormData({ ...formData, contact_email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Status
                    </label>
                    <select
                    value={formData.status}
                    onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                    <option value="Active">Active</option>
                    <option value="Unsubscribed">Unsubscribed</option>
                    </select>
                </div>
                <div className="flex gap-4">
                    <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                    >
                    Add Contact
                    </button>
                    <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                    >
                    Cancel
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}

        {/* Edit Contact Modal */}
        {showEditModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6">Edit Contact</h2>
                <form onSubmit={handleUpdateContact}>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Name
                    </label>
                    <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Email
                    </label>
                    <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) =>
                        setFormData({ ...formData, contact_email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                    Status
                    </label>
                    <select
                    value={formData.status}
                    onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                    <option value="Active">Active</option>
                    <option value="Unsubscribed">Unsubscribed</option>
                    </select>
                </div>
                <div className="flex gap-4">
                    <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                    >
                    Update Contact
                    </button>
                    <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                    >
                    Cancel
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    );
}

export default Contact;
