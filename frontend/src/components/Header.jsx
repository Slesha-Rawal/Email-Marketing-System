import React from "react";
import { Mail } from "lucide-react";

function Header() {
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold">Email Portal</span>
      </div>
    </div>
  );
}

export default Header;
