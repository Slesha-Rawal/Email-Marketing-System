import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const Templates = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Mock data - replace with actual API call
  const [templates, setTemplates] = useState([
    {
      id: 1,
      title: 'Welcome Email',
      subject: 'Welcome to Our Community!',
      content: 'Thank you for joining our growing community! We\'re thrilled to have you on board.',
      createdAt: '2026-02-01',
      updatedAt: '2026-02-05'
    },
    {
      id: 2,
      title: 'Teachers!! exciting news',
      subject: 'Turn YouTube Videos into Quizzes',
      content: 'You can now turn any Youtube Video into interactive video quizzes that your students will absolutely love!!',
      createdAt: '2026-01-28',
      updatedAt: '2026-02-03'
    },
    {
      id: 3,
      title: 'Newsletter Template',
      subject: 'Monthly Newsletter - February 2026',
      content: 'Check out our latest updates and announcements for this month.',
      createdAt: '2026-01-25',
      updatedAt: '2026-02-01'
    },
    {
      id: 4,
      title: 'Promotional Campaign',
      subject: 'Special Offer Just for You!',
      content: 'Don\'t miss out on our exclusive promotion available for a limited time only.',
      createdAt: '2026-01-20',
      updatedAt: '2026-01-30'
    }
  ]);

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setTemplates(templates.filter(template => template.id !== id));
    }
  };

  const handleEdit = (template) => {
    navigate('/template-builder', { state: { template } });
  };

  const handleCreateNew = () => {
    navigate('/template-builder');
  };

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-3 rounded-lg">
                  <Mail size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Email Templates</h2>
                  <p className="text-gray-600 text-sm">Manage your email templates</p>
                </div>
              </div>
              <button 
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={20} />
                Create Template
              </button>
            </div>

            {/* Search and Filter Section */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search templates by name, subject, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="name">Sort by Name</option>
                <option value="created">Date Created</option>
                <option value="modified">Last Modified</option>
              </select>
            </div>

            {/* Templates List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Templates List</h3>
                <span className="text-sm text-gray-600">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                </span>
              </div>
              
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <Mail size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No templates found</h3>
                  <p className="text-gray-500 mb-6">
                    {searchQuery ? 'Try adjusting your search' : 'Get started by creating your first email template'}
                  </p>
                  {!searchQuery && (
                    <button 
                      onClick={handleCreateNew}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={20} />
                      Create Template
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => (
                    <div 
                      key={template.id} 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all hover:border-indigo-200 bg-white"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                          <Mail size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg mb-1 text-gray-800 truncate">
                            {template.title}
                          </h4>
                          <p className="text-sm text-indigo-600 font-medium mb-2 truncate">
                            {template.subject}
                          </p>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {template.content}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          <div>Created: {new Date(template.createdAt).toLocaleDateString()}</div>
                          <div>Updated: {new Date(template.updatedAt).toLocaleDateString()}</div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button 
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                            title="Preview"
                          >
                            <Eye size={18} className="text-gray-600 group-hover:text-indigo-600" />
                          </button>
                          <button 
                            onClick={() => handleEdit(template)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors group" 
                            title="Edit"
                          >
                            <Edit2 size={18} className="text-gray-600 group-hover:text-indigo-600" />
                          </button>
                          <button 
                            onClick={() => handleDelete(template.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors group" 
                            title="Delete"
                          >
                            <Trash2 size={18} className="text-gray-600 group-hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Templates;
