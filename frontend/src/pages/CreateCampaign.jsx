import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import RichTextEditor from "../components/RichTextEditor.jsx";

const initialFormData = {
  campaign_name: "",
  template_id: "",
  campaign_subject: "",
  campaign_body: "",
  contact_segment: "all",
  sender_name: "",
  reply_to_email: "",
  sender_email: "",
  schedule_option: "sent",
  scheduled_date: "",
};

const getAudienceLabel = (contactSegment, groups) => {
  if (!contactSegment || contactSegment === "all") {
    return "All Contacts";
  }

  if (contactSegment.startsWith("group:")) {
    const groupId = Number.parseInt(contactSegment.replace("group:", ""), 10);
    const selectedGroup = groups.find((group) => group.group_id === groupId);
    return selectedGroup
      ? `Group: ${selectedGroup.group_name}`
      : "Selected Group";
  }

  if (contactSegment === "active") {
    return "Active Contacts";
  }

  if (contactSegment === "unsubscribed") {
    return "Unsubscribed Contacts";
  }

  return contactSegment;
};

const CreateCampaign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editingCampaign = location.state?.campaign;

  const [formData, setFormData] = useState(initialFormData);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showAudienceDialog, setShowAudienceDialog] = useState(false);
  const [error, setError] = useState("");
  const canEditTemplateDrivenFields =
    Boolean(formData.template_id) || Boolean(editingCampaign?.campaign_id);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templateResponse, groupResponse] = await Promise.all([
          api.get("/templates"),
          api.get("/contact-groups"),
        ]);

        setTemplates(templateResponse.data);
        setGroups(groupResponse.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Failed to load form data",
        );
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (editingCampaign) {
      setFormData({
        campaign_name: editingCampaign.campaign_name || "",
        template_id: editingCampaign.template_id || "",
        campaign_subject: editingCampaign.campaign_subject || "",
        campaign_body: editingCampaign.campaign_body || "",
        contact_segment: editingCampaign.contact_segment || "all",
        sender_name: editingCampaign.sender_name || "",
        reply_to_email: editingCampaign.reply_to_email || "",
        sender_email: editingCampaign.sender_email || "",
        schedule_option: editingCampaign.campaign_status || "sent",
        scheduled_date: editingCampaign.scheduled_date
          ? new Date(editingCampaign.scheduled_date).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [editingCampaign]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "template_id") {
      const selectedTemplate = templates.find(
        (template) => String(template.template_id) === String(value),
      );

      if (selectedTemplate) {
        setFormData((prev) => ({
          ...prev,
          template_id: value,
          campaign_subject: selectedTemplate.template_subject,
          campaign_body: selectedTemplate.template_body,
        }));
      }
    }
  };

  const handleSelectAudience = (segmentValue) => {
    setFormData((prev) => ({
      ...prev,
      contact_segment: segmentValue,
    }));
    setShowAudienceDialog(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const missingFields = [];

    if (!formData.campaign_name.trim()) {
      missingFields.push("Campaign name");
    }

    if (!String(formData.template_id || "").trim()) {
      missingFields.push("Template");
    }

    if (!formData.campaign_subject.trim()) {
      missingFields.push("Email subject");
    }

    if (!formData.sender_name.trim()) {
      missingFields.push("Sender name");
    }

    if (!formData.sender_email.trim()) {
      missingFields.push("Sender email");
    }

    if (missingFields.length > 0) {
      setError(`Please fill required fields: ${missingFields.join(", ")}`);
      return;
    }

    if (formData.schedule_option === "scheduled" && !formData.scheduled_date) {
      setError("Select a schedule date for scheduled campaigns");
      return;
    }

    const payload = {
      campaign_name: formData.campaign_name.trim(),
      template_id: formData.template_id || null,
      campaign_subject: formData.campaign_subject.trim(),
      campaign_body: formData.campaign_body.trim(),
      contact_segment: formData.contact_segment,
      sender_name: formData.sender_name.trim(),
      reply_to_email: formData.reply_to_email.trim(),
      sender_email: formData.sender_email.trim().toLowerCase(),
      // "Send Now" should dispatch after save, not just persist a sent status.
      campaign_status:
        formData.schedule_option === "sent"
          ? "draft"
          : formData.schedule_option,
      scheduled_date:
        formData.schedule_option === "scheduled"
          ? formData.scheduled_date
          : null,
    };

    try {
      let campaignId = editingCampaign?.campaign_id;

      if (editingCampaign?.campaign_id) {
        await api.put(`/campaigns/${editingCampaign.campaign_id}`, payload);
      } else {
        const response = await api.post("/campaigns", payload);
        campaignId = response.data?.id;
      }

      if (formData.schedule_option === "sent") {
        if (!campaignId) {
          setError("Campaign saved but send failed: missing campaign id");
          return;
        }

        await api.post(`/campaigns/${campaignId}/send`);
      }

      navigate("/campaigns");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to save campaign",
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <div className="p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {editingCampaign ? "Edit Campaign" : "Create Campaign"}
            </h3>

            <div className="mb-8">
              <h4 className="text-base font-semibold text-gray-800 mb-1">
                Campaign Details
              </h4>
              <p className="text-sm text-gray-500">
                Only marketing users can create or send campaigns.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    name="campaign_name"
                    value={formData.campaign_name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template
                  </label>
                  <select
                    name="template_id"
                    value={formData.template_id}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Template</option>
                    {templates.map((template) => (
                      <option
                        key={template.template_id}
                        value={template.template_id}
                      >
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                {canEditTemplateDrivenFields ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        name="campaign_subject"
                        value={formData.campaign_subject}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Recipient Segment
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAudienceDialog(true)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-left text-sm text-gray-700 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {getAudienceLabel(formData.contact_segment, groups)}
                      </button>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campaign Body
                      </label>
                      <RichTextEditor
                        value={formData.campaign_body}
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            campaign_body: value,
                          }))
                        }
                        placeholder="Write your campaign content..."
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    Select a template to auto-fill email subject and campaign
                    content.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    name="sender_name"
                    value={formData.sender_name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    name="reply_to_email"
                    value={formData.reply_to_email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    name="sender_email"
                    value={formData.sender_email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Option
                  </label>
                  <select
                    name="schedule_option"
                    value={formData.schedule_option}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="sent">Send Now</option>
                    <option value="scheduled">Schedule for Later</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>

                {formData.schedule_option === "scheduled" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduled Date
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduled_date"
                      value={formData.scheduled_date}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/campaigns")}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingCampaign ? "Update" : "Save"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showAudienceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-1">
              Select Recipients
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Choose who should receive this campaign.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => handleSelectAudience("all")}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  formData.contact_segment === "all"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                All Contacts
              </button>

              {groups.map((group) => {
                const groupSegment = `group:${group.group_id}`;
                const isSelected = formData.contact_segment === groupSegment;

                return (
                  <button
                    key={group.group_id}
                    type="button"
                    onClick={() => handleSelectAudience(groupSegment)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {group.group_name}
                  </button>
                );
              })}

              {groups.length === 0 && (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No groups found. Defaulting to All Contacts.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAudienceDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateCampaign;
