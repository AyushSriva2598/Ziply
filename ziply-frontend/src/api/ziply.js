const BASE_URL = import.meta.env.VITE_API_BASE;

export async function shortenUrl(longUrl) {
  const res = await fetch(`${BASE_URL}/api/v1/shorten/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ long_url: longUrl }),
  });

  if (res.status === 429) throw new Error("Rate limit hit. Try again later.");
  if (res.status === 400) throw new Error("Invalid URL.");
  if (!res.ok) throw new Error("Something went wrong.");

  return await res.json(); // { short_url: "http://localhost:8000/abc123" }
}

export async function resolveUrl(shortCode) {
  const res = await fetch(`${BASE_URL}/${shortCode}`, {
    method: "GET",
    redirect: "manual", // capture 301, don't follow
  });

  if (res.status === 301 || res.status === 302) {
    return { location: res.headers.get("Location") };
  }
  if (res.status === 404) throw new Error("Short URL not found.");
  throw new Error("Something went wrong.");
}