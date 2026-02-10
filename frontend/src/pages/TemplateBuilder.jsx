import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Mail, Bold, Italic, Underline, List, ListOrdered, Link, Image, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Monitor, Smartphone,
  Save, ArrowLeft
} from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTemplate = location.state?.template;

  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [previewMode, setPreviewMode] = useState('desktop');

  const defaultContent = `Welcome to Our Community! 🎉

Dear [Name],

Thank you for joining our growing community at Kung Fu Quiz! We're thrilled to have you on board.

To help you get started, here are a few useful links:
• Sifu Guide
• Help page

We're constantly working to improve your experience. Feel free to reach out if you have any questions.

Best regards,
The Kung Fu Quiz Team`;

  useEffect(() => {
    if (editTemplate) {
      setTemplateName(editTemplate.title);
      setTemplateSubject(editTemplate.subject);
      setEmailContent(editTemplate.content);
    } else {
      setEmailContent(defaultContent);
    }
  }, [editTemplate]);

  const handleSave = () => {
    if (!templateName || !templateSubject || !emailContent) {
      alert('Please fill in all fields');
      return;
    }

    // Here you would typically make an API call to save the template
    const templateData = {
      title: templateName,
      subject: templateSubject,
      content: emailContent,
      updatedAt: new Date().toISOString()
    };

    console.log('Saving template:', templateData);
    alert('Template saved successfully!');
    navigate('/templates');
  };

  const toolbarButtons = [
    { icon: Bold, title: 'Bold' },
    { icon: Italic, title: 'Italic' },
    { icon: Underline, title: 'Underline' },
    { divider: true },
    { icon: List, title: 'Bullet List' },
    { icon: ListOrdered, title: 'Numbered List' },
    { divider: true },
    { icon: Link, title: 'Insert Link' },
    { icon: Image, title: 'Insert Image' },
    { divider: true },
    { icon: AlignLeft, title: 'Align Left' },
    { icon: AlignCenter, title: 'Align Center' },
    { icon: AlignRight, title: 'Align Right' },
    { icon: AlignJustify, title: 'Justify' },
  ];

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
                <button
                  onClick={() => navigate('/templates')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to templates"
                >
                  <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div className="bg-indigo-600 text-white p-3 rounded-lg">
                  <Mail size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {editTemplate ? 'Edit Template' : 'Create New Template'}
                  </h2>
                  <p className="text-gray-600 text-sm">Design your email template with live preview</p>
                </div>
              </div>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Save size={20} />
                Save Template
              </button>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Editor Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Welcome Email, Newsletter Template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Welcome to our community!"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Content
                  </label>
                  
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg flex-wrap">
                    {toolbarButtons.map((button, index) => (
                      button.divider ? (
                        <div key={`divider-${index}`} className="w-px h-6 bg-gray-300 mx-1"></div>
                      ) : (
                        <button
                          key={index}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title={button.title}
                          type="button"
                        >
                          <button.icon size={18} />
                        </button>
                      )
                    ))}
                  </div>

                  {/* Content Editor */}
                  <textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[500px] font-sans resize-none"
                    placeholder="Start typing your email content... Use [Name] for personalization."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Tip: Use placeholders like [Name], [Email], [Company] for personalization
                  </p>
                </div>
              </div>

              {/* Preview Section */}
              <div className="space-y-4">
                <div className="sticky top-0">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      Live Email Preview
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                          previewMode === 'desktop' 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Monitor size={16} />
                        Desktop
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                          previewMode === 'mobile' 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Smartphone size={16} />
                        Mobile
                      </button>
                    </div>
                  </div>

                  {/* Email Preview Box */}
                  <div className={`bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden transition-all ${
                    previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''
                  }`}>
                    {/* Email Header */}
                    <div className="bg-white border-b border-gray-200 p-4">
                      <div className="text-xs text-gray-500 mb-1">Subject:</div>
                      <div className="font-semibold text-gray-800">
                        {templateSubject || 'Email Subject Preview'}
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="bg-white p-6 min-h-[500px]">
                      {emailContent ? (
                        <div className="space-y-3">
                          {emailContent.split('\n').map((line, index) => {
                            // Check if line is a bullet point
                            if (line.trim().startsWith('•')) {
                              return (
                                <div key={index} className="flex gap-2">
                                  <span>•</span>
                                  <span>{line.trim().substring(1).trim()}</span>
                                </div>
                              );
                            }
                            // Check if line looks like a link
                            if (line.trim() && (line.includes('http') || line.toLowerCase().includes('guide') || line.toLowerCase().includes('page'))) {
                              return (
                                <a key={index} href="#" className="text-indigo-600 hover:underline block">
                                  {line.trim()}
                                </a>
                              );
                            }
                            // Regular paragraph
                            return line.trim() ? (
                              <p key={index} className="text-gray-800">
                                {line}
                              </p>
                            ) : (
                              <div key={index} className="h-2"></div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 py-12">
                          <Mail size={48} className="mx-auto mb-3 opacity-50" />
                          <p>Your email preview will appear here</p>
                        </div>
                      )}
                    </div>

                    {/* Email Footer */}
                    <div className="bg-gray-100 p-4 border-t border-gray-200">
                      <p className="text-xs text-gray-600 text-center">
                        This is a preview of your email template
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => navigate('/templates')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Save as Draft
                </button>
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save & Publish
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TemplateBuilder;
