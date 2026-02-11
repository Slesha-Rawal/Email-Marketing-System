import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

const CreateCampaign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editingCampaign = location.state?.campaign;

  const [formData, setFormData] = useState({
    campaignName: "",
    template: "",
    emailSubject: "",
    contactList: "",
    senderName: "",
    replyToEmail: "",
    senderEmail: "",
    scheduleOption: "",
  });

  // If editing, populate form with existing data
  useEffect(() => {
    if (editingCampaign) {
      setFormData({
        campaignName: editingCampaign.name || "",
        template: "",
        emailSubject: editingCampaign.subject || "",
        contactList: "",
        senderName: "",
        replyToEmail: "",
        senderEmail: "",
        scheduleOption: "",
      });
    }
  }, [editingCampaign]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.campaignName ||
      !formData.emailSubject ||
      !formData.senderName ||
      !formData.senderEmail
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Here you would typically make an API call to save the campaign
    console.log("Campaign Data:", formData);

    alert(
      editingCampaign
        ? "Campaign updated successfully!"
        : "Campaign sent successfully!",
    );
    navigate("/campaigns");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <div className="p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl">
            <h3 className="text-2xl font-bold mb-2">
              {editingCampaign ? "Edit Campaign" : "Send Campaign"}
            </h3>

            <div className="mb-8">
              <h4 className="text-lg font-bold mb-1">Campaign Details</h4>
              <p className="text-gray-500 text-sm">
                Provide information about your email campaign
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="campaignName"
                    value={formData.campaignName}
                    onChange={handleInputChange}
                    placeholder="Premium Distribution"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template
                  </label>
                  <select
                    name="template"
                    value={formData.template}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Template</option>
                    <option value="template1">Welcome Email</option>
                    <option value="template2">Teachers!! exciting news</option>
                    <option value="template3">Newsletter Template</option>
                    <option value="template4">Promotional Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emailSubject"
                    value={formData.emailSubject}
                    onChange={handleInputChange}
                    placeholder="Unlock exclusive discounts!"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Contact List
                  </label>
                  <select
                    name="contactList"
                    value={formData.contactList}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Contact List</option>
                    <option value="all">All Contacts</option>
                    <option value="active">Active Contacts</option>
                    <option value="inactive">Inactive Contacts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleInputChange}
                    placeholder="Kung Fu Quiz"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    name="replyToEmail"
                    value={formData.replyToEmail}
                    onChange={handleInputChange}
                    placeholder="reply@marketingteam.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="senderEmail"
                    value={formData.senderEmail}
                    onChange={handleInputChange}
                    placeholder="kungfuquiz@marketingteam.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Option
                  </label>
                  <select
                    name="scheduleOption"
                    value={formData.scheduleOption}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Send Now</option>
                    <option value="schedule">Schedule for Later</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/campaigns")}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  {editingCampaign ? "Update" : "Send"}
                  <ArrowRight size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaign;
