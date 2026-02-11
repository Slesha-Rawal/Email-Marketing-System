import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const Campaigns = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');

  // Mock data - replace with actual API call
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: 'Christmas 2025 offer',
      subject: 'Celebrate Christmas with discounts',
      status: 'Sent',
      sendDate: '2025-12-25 09:30 AM'
    },
    {
      id: 2,
      name: 'New Launch',
      subject: 'Introducing our new feature',
      status: 'Scheduled',
      sendDate: '2025-12-31 09:30 AM'
    },
    {
      id: 3,
      name: 'New year wish',
      subject: 'Happy New Year!!',
      status: 'Scheduled',
      sendDate: '2026-01-01 09:30 AM'
    },
    {
      id: 4,
      name: 'New Launch',
      subject: 'Introducing out new product',
      status: 'Sent',
      sendDate: '2023-11-02 09:30 AM'
    }
  ]);

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      setCampaigns(campaigns.filter(campaign => campaign.id !== id));
    }
  };

  const handleEdit = (campaign) => {
    // Navigate to create campaign page with campaign data for editing
    navigate('/create-campaign', { state: { campaign } });
  };

  // Filter campaigns based on search and filters
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <Header />
        
        <div className="p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Campaigns</h3>
              <button 
                onClick={() => navigate('/create-campaign')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={20} />
                Create campaign
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search Campaigns"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Status</option>
                <option value="Sent">Sent</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Draft">Draft</option>
              </select>
              <select 
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Sort by Time</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Campaign Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Subject</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Send Date</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length > 0 ? (
                    filteredCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 font-medium text-gray-900">{campaign.name}</td>
                        <td className="py-4 px-4 text-gray-600">{campaign.subject}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            campaign.status === 'Sent' 
                              ? 'bg-green-100 text-green-700' 
                              : campaign.status === 'Scheduled'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">{campaign.sendDate}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEdit(campaign)}
                              className="p-2 hover:bg-gray-100 rounded transition-colors" 
                              title="Edit"
                            >
                              <Edit2 size={18} className="text-gray-600" />
                            </button>
                            <button 
                              onClick={() => handleDelete(campaign.id)}
                              className="p-2 hover:bg-gray-100 rounded transition-colors" 
                              title="Delete"
                            >
                              <Trash2 size={18} className="text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        No campaigns found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
