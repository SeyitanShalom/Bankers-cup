import { getCompetitionData } from "@/lib/data";

export const dynamic = "force-dynamic";

function formatPublishedAt(publishedAt: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(publishedAt));
}

export default async function NewsPage() {
  const data = await getCompetitionData();
  const posts = data.newsPosts;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
            Tournament updates
          </p>
          <h1 className="text-4xl font-black text-zinc-950">News</h1>
        </div>
        <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-600 shadow-sm">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {posts.length > 0 ? (
          posts.map((post) => (
            <article
              key={post.id}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <time
                dateTime={post.publishedAt}
                className="text-xs font-black uppercase tracking-wide text-emerald-700"
              >
                {formatPublishedAt(post.publishedAt)}
              </time>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">{post.title}</h2>
              <p className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-zinc-600">
                {post.body}
              </p>
            </article>
          ))
        ) : (
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
            <h2 className="text-2xl font-black text-zinc-950">No news yet</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-500">
              Match updates and tournament announcements will appear here.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
