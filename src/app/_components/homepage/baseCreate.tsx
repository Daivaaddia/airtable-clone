'use client'

import { api } from "~/trpc/react"
import { useRouter } from 'next/navigation'
import type { Base } from '@prisma/client'

export function BaseCreate() {
    const router = useRouter();

    const createBase = api.base.create.useMutation({
        onSuccess: async (data: Base) => { // TODO: CHANGE TYPE
            router.push(`/${data.id}`)        
        },
    });
    
    return (
        <div>
            <button
            className="bg-[#166ee1] rounded-md text-white text-sm px-3 py-1.5 shadow-sm cursor-pointer" 
            onClick={() => {
                createBase.mutate({ name: "Untitled Base" })
                }}
            >
                Create
            </button>
        </div>
    )
}