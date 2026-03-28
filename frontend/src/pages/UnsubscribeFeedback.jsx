import React, { useState } from "react";

const UnsubscribeFeedback = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const options = [
    { id: "not-relevant", label: "Your emails are not relevant to me" },
    { id: "too-frequent", label: "Your emails are too frequent" },
    { id: "didnt-signup", label: "I didn't sign up for this" },
    { id: "privacy", label: "Privacy concerns" },
    { id: "other", label: "I've got other reasons" },
  ];

  const handleSubmit = () => {
    if (!selectedOption) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#efefef] flex items-start justify-center p-6 md:p-10 font-sans">
      <div className="w-full max-w-4xl animate-fade-up">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-black mb-7">
          Thank you!
        </h1>
        <div className="bg-[#efefef] border border-[#d7d7d7] rounded-lg p-8 md:p-12 shadow-sm">
          <p className="text-[#111] text-base md:text-lg leading-relaxed mb-4">
            You have been successfully removed from this subscriber list and
            won't receive any further emails from us.
          </p>
          <p className="text-[#111] text-base md:text-lg leading-relaxed mb-8">
            Please take a moment and let us know why you unsubscribed, so that
            we can set it right.
          </p>

          <div
            className={`flex flex-col gap-4 mb-10 ${isSubmitted ? "opacity-40 pointer-events-none" : ""}`}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full rounded-xl border px-6 py-4 text-left text-lg md:text-xl leading-tight transition-colors
                  ${
                    selectedOption === option.id
                      ? "border-[#6c63e6] bg-[#f1f0ff] text-black"
                      : "border-[#9f9f9f] bg-[#efefef] text-black hover:bg-[#f6f6f6]"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            {!isSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!selectedOption}
                className="inline-flex items-center gap-2 bg-[#6c63e6] text-white rounded-lg px-8 py-3 text-base md:text-lg font-semibold transition-all hover:bg-[#5b53d6] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            ) : (
              <div className="w-full text-center py-2 text-[#5a4fcf] text-base md:text-lg font-semibold animate-fade-up">
                ✓ Thanks for your feedback!
              </div>
            )}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fade-up 0.5s ease both;
        }
      `,
        }}
      />
    </div>
  );
};

export default UnsubscribeFeedback;
