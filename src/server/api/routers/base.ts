import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const bases = ctx.db.base.findMany({
            where: { createdById: ctx.session.user.id },
            orderBy: { createdAt: "desc" },
        });
        
        return bases ?? [];
    }),

    create: protectedProcedure
        .input(z.object({ name: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.db.base.create({
                data: {
                    name: input.name,
                    createdBy: { connect: { id: ctx.session.user.id } }
                }
            });
        })
});