import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Plus,
  Upload,
  User,
  Users,
  X,
  Mail,
  Cloud,
  FolderPlus,
  SkipForward,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AddContact = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [verifySingle, setVerifySingle] = useState(false);
  const [verifyImport, setVerifyImport] = useState(false);

  // Grouping state
  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [modalStep, setModalStep] = useState("options"); // options, existing, new
  const [selectedOption, setSelectedOption] = useState("skip");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFileForGroup, setPendingFileForGroup] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // single | upload

  const fetchGroups = async () => {
    try {
      const response = await api.get("/contact-groups");
      setGroups(response.data);
    } catch (err) {
      console.error("Failed to load groups for dropdown:", err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openGroupModalForAction = (action) => {
    setSelectedOption("skip");
    setSelectedGroupId("");
    setNewGroupName("");
    setModalStep("options");
    setPendingAction(action);
    setShowGroupModal(true);
  };

  const handleAddContactClick = () => {
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

    openGroupModalForAction("single");
  };

  const addSingleContact = async (groupAction, groupValue) => {
    setMessage("");
    setError("");

    const response = await api.post("/contacts", {
      contact_name: name.trim(),
      contact_email: email.trim().toLowerCase(),
      contact_status: "active",
      verify: verifySingle,
    });

    const newContactId = response?.data?.id;

    if (newContactId && groupAction !== "skip") {
      let targetGroupId = groupAction === "existing" ? groupValue : null;

      if (groupAction === "new") {
        const createdGroup = await api.post("/contact-groups", {
          group_name: groupValue,
        });
        targetGroupId = createdGroup?.data?.group_id;
      }

      if (targetGroupId) {
        await api.post(`/contact-groups/${targetGroupId}/contacts`, {
          contactIds: [newContactId],
        });
      }
    }

    try {
      await fetchGroups();
      setMessage("Contact added successfully");
      setName("");
      setEmail("");
      setTimeout(() => navigate("/contact"), 800);
    } catch {
      // No-op, message flow should continue even if groups refresh fails.
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setError("Only CSV files are allowed");
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    const input = document.getElementById("file-upload");
    if (input) {
      input.value = "";
    }
  };

  const handleUploadClick = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first");
      return;
    }
    setPendingFileForGroup(selectedFile);
    openGroupModalForAction("upload");
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setModalStep("options");
    setPendingAction(null);
  };

  const handleModalContinue = async () => {
    if (modalStep === "options") {
      if (selectedOption === "skip") {
        try {
          if (pendingAction === "single") {
            await addSingleContact("skip", null);
          } else {
            await performUpload("skip", null);
          }
          closeGroupModal();
        } catch (requestError) {
          setError(
            requestError.response?.data?.error ||
              requestError.response?.data?.message ||
              "Failed to continue",
          );
        }
      } else if (selectedOption === "existing") {
        setModalStep("existing");
      } else if (selectedOption === "new") {
        setModalStep("new");
      }
    } else if (modalStep === "existing") {
      if (!selectedGroupId) {
        setError("Please select a group");
        return;
      }
      try {
        if (pendingAction === "single") {
          await addSingleContact("existing", selectedGroupId);
        } else {
          await performUpload("existing", selectedGroupId);
        }
        closeGroupModal();
      } catch (requestError) {
        setError(
          requestError.response?.data?.error ||
            requestError.response?.data?.message ||
            "Failed to continue",
        );
      }
    } else if (modalStep === "new") {
      if (!newGroupName.trim()) {
        setError("Please enter a group name");
        return;
      }
      try {
        if (pendingAction === "single") {
          await addSingleContact("new", newGroupName.trim());
        } else {
          await performUpload("new", newGroupName.trim());
        }
        closeGroupModal();
      } catch (requestError) {
        setError(
          requestError.response?.data?.error ||
            requestError.response?.data?.message ||
            "Failed to continue",
        );
      }
    }
  };

  const performUpload = async (groupAction, groupValue) => {
    if (!pendingFileForGroup) {
      setError("No file selected");
      return;
    }

    setMessage("");
    setError("");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", pendingFileForGroup);
    formData.append("verify", String(verifyImport));

    if (groupAction === "existing" && groupValue) {
      formData.append("groupId", groupValue);
    } else if (groupAction === "new" && groupValue) {
      formData.append("newGroupName", groupValue);
    }

    try {
      const response = await api.post("/contacts/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage(response.data.message);
      setPendingFileForGroup(null);
      setSelectedFile(null);
      const input = document.getElementById("file-upload-dropzone");
      if (input) input.value = "";
      setTimeout(() => navigate("/contact"), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <main className="p-8">
          <div className="w-full">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Add Client</h1>
              <p className="mt-1 text-sm text-gray-500">
                Add one contact manually or import multiple contacts with a
                file.
              </p>
            </header>

            {message && (
              <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 border border-green-200">
                <Check className="h-4 w-4" />
                {message}
              </div>
            )}
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 border border-red-200">
                <X className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* CARD 1: ADD ONE CONTACT */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Add one Contact
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Name"
                    className="w-full rounded-lg border-none bg-transparent pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                  />
                </div>

                <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Email Address"
                    className="w-full rounded-lg border-none bg-transparent pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 mb-6">
                <input
                  type="checkbox"
                  id="verify-single-email"
                  checked={verifySingle}
                  onChange={(e) => setVerifySingle(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label
                  htmlFor="verify-single-email"
                  className="flex flex-col cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-900">
                    Verify emails
                  </span>
                </label>
              </div>

              <button
                onClick={handleAddContactClick}
                className="mx-auto flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
              >
                + Add contact
              </button>
            </div>

            {/* CARD 2: ADD MULTIPLE CONTACTS */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Add Multiple Contacts
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  CSV file
                </label>
                <div
                  onClick={() =>
                    document.getElementById("file-upload-dropzone").click()
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add(
                      "border-indigo-500",
                      "bg-indigo-50",
                    );
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove(
                      "border-indigo-500",
                      "bg-indigo-50",
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(
                      "border-indigo-500",
                      "bg-indigo-50",
                    );
                    if (e.dataTransfer.files[0])
                      handleFileSelect({
                        target: { files: e.dataTransfer.files },
                      });
                  }}
                  className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                      ✓ {selectedFile.name}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center mb-3 text-gray-400">
                        <Cloud className="w-10 h-10" />
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        Upload a file
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        CSV or Excel (XLSX) files only
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    id="file-upload-dropzone"
                    accept=".csv,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 mb-6">
                <input
                  type="checkbox"
                  id="verify-import-emails"
                  checked={verifyImport}
                  onChange={(e) => setVerifyImport(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label
                  htmlFor="verify-import-emails"
                  className="flex flex-col cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-900">
                    Verify emails
                  </span>
                </label>
              </div>

              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className="mx-auto flex w-fit items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4 stroke-[3px]" />
                Upload File
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg border border-gray-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeGroupModal}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Add to Group
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose how you want to assign contacts.
            </p>

            {modalStep === "options" && (
              <div className="space-y-2.5 mb-6">
                {[
                  {
                    id: "skip",
                    icon: SkipForward,
                    title: "Skip",
                    desc: "Add contacts without assigning to any group",
                  },
                  {
                    id: "existing",
                    icon: FolderPlus,
                    title: "Add to Existing Group",
                    desc: "Choose a group you've already created",
                  },
                  {
                    id: "new",
                    icon: Plus,
                    title: "Create New Group",
                    desc: "Create a new group and add contacts to it",
                  },
                ].map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      className={`w-full flex items-center gap-3 p-3.5 border rounded-xl text-left transition-all ${
                        selectedOption === opt.id
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedOption === opt.id ? "bg-indigo-100" : "bg-gray-100"}`}
                      >
                        <IconComp
                          className={`w-5 h-5 ${selectedOption === opt.id ? "text-indigo-600" : "text-gray-600"}`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-base font-semibold text-gray-900">
                          {opt.title}
                        </div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${selectedOption === opt.id ? "bg-indigo-600 text-white" : "border border-gray-300"}`}
                      >
                        {selectedOption === opt.id && (
                          <span className="text-xs font-bold">✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {modalStep === "existing" && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
                >
                  <option value="">Choose a group...</option>
                  {groups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.group_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modalStep === "new" && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:border-indigo-300 focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeGroupModal}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalContinue}
                disabled={isUploading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {modalStep === "options" && selectedOption === "skip"
                  ? "Continue"
                  : modalStep === "options"
                    ? "Next"
                    : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddContact;
