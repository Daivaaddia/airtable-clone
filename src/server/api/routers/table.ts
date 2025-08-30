import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const defaultColumns = ["Name", "Notes", "Assignee", "Status", "Attachments", "Attachment Summary"]
const DEFAULTROWS = 3
let columnIds: string[] = []
let rowIds: string[] = []

export const tableRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.table.create({
            data: {
                name: input.name,
                base: { connect: { id: input.baseId } }
            }
        });
    }),

    createDefault: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        const table = await ctx.db.table.create({
            data: {
                name: input.name,
                base: { connect: { id: input.baseId } }
            }
        });

        let order = 0;
        defaultColumns.forEach(async (colName: string) => {
            const col = await ctx.db.column.create({
                data: {
                    name: colName,
                    order,
                    table: { connect: { id: table.id }}
                }
            });
            columnIds.push(col.id);
            order++;
        })

        for (let i = 0; i < DEFAULTROWS; i++) {
            const row = await ctx.db.row.create({
                data: {
                    order: i,
                    table: { connect: { id: table.id }}
                }
            });
            rowIds.push(row.id);
        }
        
        for (let i = 0; i < defaultColumns.length; i++) {
            for (let j = 0; j < DEFAULTROWS; j++) {
                const cell = await ctx.db.cell.create({
                    data: {
                        row: { connect: { id: rowIds[j] }},
                        column: { connect: { id: columnIds[i] }},
                        value: ""
                    }
                });
            }
        } 
        return table
    }),

    getTable: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
        return ctx.db.table.findFirst({
            where: { id: input.id },
            include: {
                columns: {
                    orderBy: {order: "asc"}
                },
                rows: {
                    orderBy: {order: "asc"},
                    include: { cells: true },
                },
            },
        });
    }),

    updateCell: protectedProcedure
    .input(z.object({ id: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.cell.update({
            where: { id: input.id },
            data: { value: input.value }
        })
    })  
});