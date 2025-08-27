import Link from "next/link";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { Header } from "./_components/homepage/header";

export default async function Home() {
  const session = await auth();
  const bases = session?.user ? await api.base.getAll() : [];

  if (session?.user) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <Header />
        <main className="flex flex-col px-14 pt-10">
          <h1 className="text-2xl font-bold mb-6">Home</h1>
          <button>

          </button>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {bases.map(( base ) => (
              <Link key={base.id} href={`/${base.id}`}>
                <div
                    className="p-6 rounded-md border border-gray-300 bg-white hover:shadow-lg text-left"
                >
                  {base.name}
                </div>
              </Link>
            )
            )}
          </div>
        </main>

            <div className="flex flex-col items-center justify-center gap-4">
              <Link
                href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
              >
                {session ? "Sign out" : "Sign in"}
              </Link>
            </div>

    </HydrateClient>
  );
}
