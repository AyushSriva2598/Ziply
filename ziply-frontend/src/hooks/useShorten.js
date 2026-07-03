import { useState } from "react";
import { shortenUrl } from "../api/ziply";

export function useShorten() {
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function shorten(longUrl) {
    if (!longUrl.trim()) return;
    setLoading(true);
    setError("");
    setShortUrl("");

    try {
      const data = await shortenUrl(longUrl);
      setShortUrl(data.short_url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return { shortUrl, loading, error, shorten };
}