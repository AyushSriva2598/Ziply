import { useShorten } from "../hooks/useShorten";

function ShortenForm() {
  const { shortUrl, loading, error, shorten } = useShorten();

  return (
    <>
      <button onClick={() => shorten("https://example.com/very/long/url")}>
        {loading ? "..." : "Shorten"}
      </button>
      {error && <p>{error}</p>}
      {shortUrl && <a href={shortUrl}>{shortUrl}</a>}
    </>
  );
}