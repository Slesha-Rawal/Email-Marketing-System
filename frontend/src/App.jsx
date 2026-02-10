import { useState } from "react";
import "./index.css";
import Login from "./pages/Login.jsx";
import Contact from "./pages/Contact.jsx";
import AddContact from "./pages/AddContact.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Templates from "./pages/Templates.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/add-contact" element={<AddContact />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/template-builder" element={<TemplateBuilder />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
