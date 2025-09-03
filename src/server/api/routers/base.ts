import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const bases = ctx.db.base.findMany({
            where: { createdById: ctx.session.user.id },
            orderBy: { lastOpened: "desc" },
        });
        
        return bases ?? [];
    }),

    getBase: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
        return ctx.db.base.update({
            where: { id: input.id },
            data: { lastOpened: new Date() },
            include: {
                tables: {
                    orderBy: { createdAt: "asc" }
                }
            },
        });
    }),

    updateName: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.base.update({
            where: { id: input.id },
            data: { name: input.name }
        })
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
    }),
});