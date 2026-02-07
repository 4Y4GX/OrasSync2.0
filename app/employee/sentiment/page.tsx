"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../login/Login.module.css";
import AuthShell from "../../components/AuthShell";

type SentimentVal = "GREAT" | "OKAY" | "NOT_GOOD" | "";

export default function SentimentPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [sentiment, setSentiment] = useState<SentimentVal>("");
  const [comment, setComment] = useState(""); // OPTIONAL
  const [error, setError] = useState("");

  const sentiments = [
    { label: "GREAT", emoji: "😊", value: "GREAT" as const },
    { label: "OKAY", emoji: "😐", value: "OKAY" as const },
    { label: "NOT GOOD", emoji: "😫", value: "NOT_GOOD" as const },
  ];

  const handleSubmit = async () => {
    setError("");

    if (!sentiment) {
      setError("PLEASE SELECT A STATUS.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employee/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentiment,
          comment: comment.trim(), // optional
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push("/employee/dashboard");
      } else {
        setError(data.message || "FAILED TO SAVE.");
      }
    } catch {
      setError("CONNECTION ERROR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell headerTag="DAILY CHECK-IN" title="SENTIMENT" subtitle="HOW ARE YOU FEELING TODAY?">
      {error ? (
        <div className="text-red-500 text-sm font-bold mb-4 text-center uppercase">{error}</div>
      ) : null}

      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 18 }}>
        {sentiments.map((s) => {
          const selected = sentiment === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setSentiment(s.value)}
              className={`${styles.sentimentBtn} ${selected ? styles.sentimentBtnSelected : ""}`}
            >
              <div style={{ fontSize: 28, lineHeight: "28px", marginBottom: 8 }}>{s.emoji}</div>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, letterSpacing: ".08em" }}>
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>COMMENT (OPTIONAL)</label>
        <textarea
          className={`${styles.input} ${styles.textareaField}`}
          placeholder="(Optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!sentiment || loading}
        style={{ marginTop: 14 }}
      >
        {loading ? "SAVING..." : "SUBMIT"}
      </button>
    </AuthShell>
  );
}
