import React, { useMemo, useState } from "react";
import api from "../lib/api.js";
import { toast } from "react-toastify";

const UnsubscribeFeedback = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { email, campaign } = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      email: searchParams.get("email") || "",
      campaign: searchParams.get("campaign") || "",
    };
  }, []);

  const options = [
    { id: "not_relevant", label: "Your emails are not relevant to me" },
    { id: "too_frequent", label: "Your emails are too frequent" },
    { id: "never_subscribed", label: "I didn't sign up for this" },
    { id: "spam", label: "These emails look like spam" },
    { id: "other", label: "I've got other reasons" },
  ];

  const handleSubmit = async () => {
    if (!selectedOption || !email) {
      setErrorMessage("Please choose a reason before submitting.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await api.post(
        "/campaigns/unsubscribe/feedback",
        {
          email,
          campaign,
          reason: selectedOption,
          comments: "",
        },
        {
          meta: {
            skipSuccessToast: true,
            skipErrorToast: true,
          },
        },
      );

      setIsSubmitted(true);
      // show toast to confirm success to user
      try {
        toast.success("Feedback submitted. Thank you!");
      } catch (t) {
        // no-op if toast fails
        console.warn("toast failed:", t);
      }
    } catch (error) {
      // Better handling for non-JSON responses (HTML) which cause JSON parse errors
      try {
        const resp = error?.response;
        if (resp) {
          const contentType = String(
            resp.headers?.["content-type"] || "",
          ).toLowerCase();
          const data = resp.data;

          if (typeof data === "string" && data.trim().startsWith("<")) {
            // Server returned HTML instead of JSON (common when a 404/HTML error page is served)
            console.error(
              "Non-JSON response from unsubscribe feedback API:",
              data,
            );
            setErrorMessage(
              "Server returned an unexpected HTML response. Please try again later.",
            );
          } else {
            const apiMessage =
              data?.error || data?.message || String(data || "");
            setErrorMessage(
              apiMessage || "Failed to save feedback. Please try again.",
            );
          }
        } else {
          setErrorMessage("Unable to reach server. Please try again.");
        }
      } catch (inner) {
        console.error("Error processing feedback submission error:", inner);
        setErrorMessage("Failed to save feedback. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 md:p-10 font-sans">
      <div className="w-full max-w-4xl animate-fade-up">
        <h1 className="text-4xl md:text-5xl font-bold text-center text-[#1E293B] mb-8">
          Thank you!
        </h1>
        <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-8 md:p-12">
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            You have been successfully removed from this subscriber list and
            won't receive any further emails from us.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed mb-10">
            Please take a moment and let us know why you unsubscribed, so that
            we can set it right.
          </p>

          <div
            className={`space-y-4 mb-10 ${isSubmitted ? "opacity-40 pointer-events-none" : ""}`}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full rounded-lg border px-5 py-4 text-left text-base transition-all
                  ${
                    selectedOption === option.id
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}
            </div>
            {!isSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!selectedOption || isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            ) : (
              <div className="text-indigo-600 font-semibold text-lg animate-fade-up">
                ✓ Feedback submitted. Thank you!
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
