import Link from "next/link";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { Header } from "./_components/homepage/header";
import { BaseCreate } from "./_components/homepage/baseCreate";
import moment from "moment";

export default async function Home() {
  const session = await auth();
  const bases = session?.user ? await api.base.getAll() : [];

  return (
    <HydrateClient>
      <Header />
        <main className="flex flex-col px-14 pt-10 bg-maingray h-screen">
          <div className="flex flex-row justify-between">
            <h1 className="text-2xl font-bold mb-6">Home</h1>
            <BaseCreate />
          </div>
        
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {bases.map(( base ) => (
              <Link key={base.id} href={`/${base.id}`}>
                <div className="flex flex-row gap-5 p-4 rounded-md border border-gray-300 bg-white hover:shadow-lg text-left">
                  <div className="text-2xl rounded-2xl bg-[#3b66a3] flex justify-center items-center text-white aspect-square w-[60px]">
                    {base.name.substring(0, 1).toUpperCase() + base.name.substring(1, 2).toLowerCase() }
                  </div>
                  <div
                      className="flex flex-col justify-center gap-1"
                  >
                    <span className="text-sm">{base.name}</span>
                    <span className="text-xs text-gray-500">Opened {moment(base.lastOpened).fromNow()}</span>
                  </div>
                </div>
              </Link>
            )
            )}
          </div>

            <div className="flex flex-col items-center justify-center gap-4">
              <Link
                href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
              >
                {session ? "Sign out" : "Sign in"}
              </Link>
            </div>
          </main>
    </HydrateClient>
  );
}
